# Token Optimization Checklist (20 Points)

## High Impact (do these first)

1. [ ] Count workspace files injected at boot
   - Target: 3 or fewer (IDENTITY, SOUL, session-state)
   - Each unnecessary file = wasted tokens every session

2. [ ] MEMORY.md under 50 lines
   - Routing index, not knowledge store
   - Move details to referenced files

3. [ ] No large files in auto-injection
   - Check: any file over 200 lines loaded at boot?
   - Fix: load on demand with offset/limit

4. [ ] Using the right model for the task
   - Research/search: Flash ($0.15/M)
   - Code/editing: Sonnet ($3/M)  
   - Complex reasoning: Opus ($15/M)
   - Never use Opus for web search

5. [ ] Parallel tool calls where possible
   - 5 sequential calls grow context 5x
   - 5 parallel calls grow context 1x
   - Plan independent calls before executing

## Medium Impact

6. [ ] Compact tool output formats
   - Use JSON extraction instead of full markdown
   - Request only fields you need

7. [ ] File reads use offset/limit
   - Don't read 2000 lines when you need 20
   - Read headers first, then target sections

8. [ ] Long outputs written to files
   - Reports, analyses, plans go to disk
   - Reference the file in conversation

9. [ ] Conversation stays focused
   - Don't re-explain context (use session-state.md)
   - Don't repeat information already in workspace files

10. [ ] Compaction frequency tracked
    - More than 3/day = context is bloated
    - More than 1/day = needs optimization

## Cost Tracking

11. [ ] Daily spend estimated
    - Formula: (input_tokens x model_rate + output_tokens x model_rate) / 1M

12. [ ] Weekly trend tracked
    - Is spend going up or down?
    - Spikes correlate with what activity?

13. [ ] Budget set and enforced
    - Daily limit: $[X]
    - Alert at 75% of budget

14. [ ] Model usage breakdown known
    - What % of tokens go to each model?
    - Are expensive models used unnecessarily?

## Advanced

15. [ ] Cache hit rate optimized
    - Stable system prompts = better cache hits
    - Don't change workspace files mid-session

16. [ ] Subagent costs monitored
    - Each subagent has its own context
    - Limit concurrent subagents

17. [ ] Image analysis calls minimized
    - Vision calls are expensive
    - Only analyze images when specifically needed

18. [ ] Search result limits set
    - Don't fetch 10 results when 3 will do
    - Use specific queries to reduce noise

19. [ ] Cron job efficiency reviewed
    - Each cron run = new context = new tokens
    - Batch cron work where possible

20. [ ] Monthly cost review scheduled
    - Compare actual vs budget
    - Identify new optimization opportunities

## Scoring

- 16-20: Optimized
- 12-15: Good
- 8-11: Room for improvement
- <8: Probably overspending by 50%+

---
*Token Optimizer by Milo Security | getmilo.dev*
