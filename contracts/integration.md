1. Admin page calls createProposal(...)
2. Proposal list page calls getProposalIds() then getProposal(...)
3. Proposal detail page reads getProposal(...) and isVotingOpen(...)
4. Voter browser  generates proof locally using proposalId as the scope
5. Frontend submits vote payload to backend
6. Backend verifies proof, checks nullifier in PostgreSQL, then relays accepted votes to castVote(...)
