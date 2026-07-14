# Brigade orchestration

User -> Brigade CLI: runs a task
Brigade CLI -> Roster: loads seats
Roster -> Coder seat: assigns the work
Coder seat -> MCP sidecars: calls tools
Coder seat -> Reviewer seat: submits the diff
Reviewer seat -> Verification: runs checks
Verification -> Outcome database: records results

The MCP sidecars include `skills`, `cards`, `scanners`, `security`, and `tools`.
