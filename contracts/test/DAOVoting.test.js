const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DAOVoting", function () {
  async function deployFixture() {
    const [owner, relayer, voter] = await ethers.getSigners();
    const DAOVoting = await ethers.getContractFactory("DAOVoting");
    const daoVoting = await DAOVoting.deploy(relayer.address);
    await daoVoting.waitForDeployment();

    return { daoVoting, owner, relayer, voter };
  }

  it("creates proposals and exposes them for the frontend", async function () {
    const { daoVoting } = await deployFixture();
    const now = await time.latest();
    const startTime = now + 60;
    const endTime = now + 3600;
    const snapshotRoot = ethers.keccak256(ethers.toUtf8Bytes("proposal-1-snapshot"));

    await expect(
      daoVoting.createProposal(1, "Fund privacy tooling", snapshotRoot, startTime, endTime)
    ).to.emit(daoVoting, "ProposalCreated");

    const proposal = await daoVoting.getProposal(1);
    expect(proposal[0]).to.equal(1n);
    expect(proposal[1]).to.equal("Fund privacy tooling");
    expect(proposal[2]).to.equal(snapshotRoot);
    expect(proposal[3]).to.equal(startTime);
    expect(proposal[4]).to.equal(endTime);
    expect(proposal[5]).to.equal(false);

    const proposalIds = await daoVoting.getProposalIds();
    expect(proposalIds).to.deep.equal([1n]);
  });

  it("allows only the vote relayer to record votes during the voting window", async function () {
    const { daoVoting, relayer, voter } = await deployFixture();
    const now = await time.latest();
    const startTime = now + 10;
    const endTime = now + 3600;
    const snapshotRoot = ethers.keccak256(ethers.toUtf8Bytes("proposal-2-snapshot"));

    await daoVoting.createProposal(2, "Adopt anonymous voting", snapshotRoot, startTime, endTime);
    await time.increaseTo(startTime + 1);

    await expect(
      //daoVoting.connect(voter).castVote(2, 0, ethers.ZeroHash, "0x")
      daoVoting.connect(voter).castVote(2, 0)
    ).to.be.revertedWithCustomError(daoVoting, "Unauthorized");

    await expect(
      //daoVoting.connect(relayer).castVote(2, 0, ethers.ZeroHash, "0x")
      daoVoting.connect(relayer).castVote(2, 0)
    ).to.emit(daoVoting, "VoteCast");

    await expect(
      //daoVoting.connect(relayer).castVote(2, 1, ethers.ZeroHash, "0x")
      daoVoting.connect(relayer).castVote(2, 1)
    ).to.emit(daoVoting, "VoteCast");

    await expect(
      //daoVoting.connect(relayer).castVote(2, 2, ethers.ZeroHash, "0x")
      daoVoting.connect(relayer).castVote(2, 2)
    ).to.emit(daoVoting, "VoteCast");

    const tally = await daoVoting.tallyVotes(2);
    expect(tally[0]).to.equal(1n);
    expect(tally[1]).to.equal(1n);
    expect(tally[2]).to.equal(1n);
  });

  it("finalizes proposals after the voting window closes", async function () {
    const { daoVoting, relayer } = await deployFixture();
    const now = await time.latest();
    const startTime = now + 5;
    const endTime = now + 100;
    const snapshotRoot = ethers.keccak256(ethers.toUtf8Bytes("proposal-3-snapshot"));

    await daoVoting.createProposal(3, "Finalize after voting", snapshotRoot, startTime, endTime);
    await time.increaseTo(startTime + 1);
    //await daoVoting.connect(relayer).castVote(3, 0, ethers.ZeroHash, "0x");
    await daoVoting.connect(relayer).castVote(3, 0);

    await expect(daoVoting.finalizeProposal(3)).to.be.revertedWithCustomError(daoVoting, "VotingStillOpen");

    await time.increaseTo(endTime + 1);

    await expect(daoVoting.finalizeProposal(3))
      .to.emit(daoVoting, "ProposalFinalized")
      .withArgs(3, 1, 0, 0);

    const proposal = await daoVoting.getProposal(3);
    expect(proposal[5]).to.equal(true);

    await expect(
      //daoVoting.connect(relayer).castVote(3, 0, ethers.ZeroHash, "0x")
      daoVoting.connect(relayer).castVote(3, 0)
    ).to.be.revertedWithCustomError(daoVoting, "ProposalFinalizedAlready");
  });
});
