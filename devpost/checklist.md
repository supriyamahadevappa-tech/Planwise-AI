---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn.

## Slices

- [x] **1. Students can manage tasks and saved study hours on the dashboard**
  Becomes usable: A responsive PlanWise dashboard where a student can add, edit, and delete tasks, set today's available hours, and return to find saved data.
  Why now: Bootstrapping, the first complete dashboard path, and local persistence belong together. The first slice gives later plan behavior a working task model and a place to appear.
  PRD ref: `prd.md > The Core Journey` (steps 1–3), `prd.md > Screens and Layout`, `prd.md > Add/Edit Task Modal`, `prd.md > Task List and Available Time`, `prd.md > Saved Data`, `prd.md > Acceptance Criteria`
  Spec ref: `spec.md > Stack`, `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Components > Dashboard`, `spec.md > Components > Task Form and Task List`, `spec.md > Components > Available Time and Plan Controls`, `spec.md > Components > Local Storage`, `spec.md > Data Model`, `spec.md > File Structure`, `spec.md > Look and Feel`
  Build: Create the Lovable project from its current template; implement the responsive dashboard and empty state, validated Add/Edit Task modal, task list actions, available-hours input, and versioned localStorage load/save. Apply the approved palette and tone. Do not add accounts or cloud task storage.
  Verify (mechanical): In Lovable Preview, add a valid task and set available hours; confirm each change saves automatically without a separate save action. Try invalid required values, edit and delete a task, reload the preview, and confirm saved task data and hours restore. Run the generated project's build command from its package manifest and confirm it completes without errors.
  Learner check: Open the Preview, add and edit a task, close/reload it, and tell me whether the dashboard and saved task details match what you expect.
  Commit: `Add dashboard tasks and local saving`

- [ ] **2. Students can get a Basic Plan that obeys the scheduling rules**
  Becomes usable: A student can generate a clearly labeled local Basic Plan with breaks, whole-task fit, and a clear list of unscheduled tasks, even without AI.
  Why now: The fallback is usable without the external service and proves the central schedule kernel before adding AI integration. It also establishes the deterministic rules the AI proposal must pass.
  PRD ref: `prd.md > AI Daily Plan`, `prd.md > AI Failure and Basic Plan`, `prd.md > States and Boundaries`, `prd.md > Acceptance Criteria`
  Spec ref: `spec.md > Components > Schedule Validator and Basic Plan Builder`, `spec.md > Components > Plan View and Completion Controls`, `spec.md > Data Model`
  Build: Implement shared deadline/priority/duration sorting and break-inclusive time calculations. Scan in the sorted order; mark a task unscheduled if its full estimate and required breaks do not fit, then continue checking later tasks without reordering. Preserve tasks and estimates; render the Basic Plan label and unscheduled-task options.
  Verify (mechanical): Before AI integration, generate Basic Plans in Preview with tasks that exercise deadline, priority, and shorter-duration ordering; include a non-fitting earlier task and a later shorter task. Check the scheduler's time-budget calculation with 45-minute study periods and required 10-minute breaks, and confirm the later task is scheduled only if it fully fits. Verify relative order is preserved, no task is shortened or split, the total stays within budget, and all unscheduled tasks are listed. Confirm Basic Plan generation makes no AI request and remains usable without the AI service.
  Learner check: Enter a few sample tasks and hours, choose **Use Basic Plan**, and check that the scheduled and unscheduled tasks make sense against the time you entered.
  Commit: `Add local Basic Plan scheduling`

- [ ] **3. Students can generate and safely recover from AI plans**
  Becomes usable: A student can request a real AI plan, see loading feedback, and receive only a validated schedule; invalid proposals or service errors preserve data and offer Retry or Basic Plan.
  Why now: The protected AI call and proposal validation are the largest external-service risk. The local Basic Plan already provides a usable route if this service is unavailable.
  PRD ref: `prd.md > The Core Journey` (steps 4 and 7), `prd.md > AI Daily Plan`, `prd.md > AI Failure and Basic Plan`, `prd.md > Task List and Available Time`, `prd.md > Acceptance Criteria`
  Spec ref: `spec.md > The Core Journey Through the System`, `spec.md > Components > AI Plan Request Function`, `spec.md > Components > Schedule Validator and Basic Plan Builder`, `spec.md > Components > Plan View and Completion Controls`, `spec.md > External Services and Dependencies`, `spec.md > Important Failure Modes`
  Build: Enable Lovable Cloud AI and implement the protected `generate-study-plan` Edge Function. Send only task title, optional description, deadline, priority, estimated duration, and available/remaining minutes. Add the processing notice, loading and duplicate-request handling, AI-generated first steps and timing reasons, deterministic validation, safe plan replacement, outdated state, and Retry/Basic Plan recovery. Keep all secrets backend-only.
  Verify (mechanical): In Preview, make a live AI request and confirm the proposed plan passes ordering, complete-task, break, and time-budget validation before it is saved. Inspect the request payload and confirm it contains only the approved fields. Exercise an AI failure or invalid response and confirm the prior plan/data remain while Retry and Use Basic Plan are offered; confirm a changed task/hour marks the existing plan outdated without rearranging it.
  Learner check: Request an AI plan, read the first steps and timing reasons, then try the recovery controls if the request fails. Tell me whether the plan is clear and the fallback is easy to find.
  Commit: `Add protected AI planning and recovery`

- [ ] **4. Students can track progress and accept a revised plan**
  Becomes usable: A student can save completion progress, request a plan for unfinished work using remaining hours, review it, and accept it without losing the previous plan before acceptance.
  Why now: This completes the approved recovery loop after both planning paths exist. It keeps rescheduling focused on unfinished work and preserves student control over replacing a plan.
  PRD ref: `prd.md > The Core Journey` (steps 5–6), `prd.md > Completion and Rescheduling`, `prd.md > Saved Data`, `prd.md > Acceptance Criteria`
  Spec ref: `spec.md > Components > Available Time and Plan Controls`, `spec.md > Components > Plan View and Completion Controls`, `spec.md > Components > Schedule Validator and Basic Plan Builder`, `spec.md > Data Model`, `spec.md > Important Failure Modes`
  Build: Persist block completion. After **Reschedule**, collect remaining hours, propose a plan from unfinished tasks with the same order/fit/skip rules, and require acceptance before it replaces the prior plan. Preserve completed statuses where possible and keep the dashboard usable if rescheduling fails.
  Verify (mechanical): In Preview, mark a block complete, reload and confirm it remains complete; request a revision, confirm only unfinished work is used and the proposal obeys the remaining-time rules, then cancel once and accept once. Confirm the previous plan remains until acceptance and completed statuses are retained where possible.
  Learner check: Mark one block complete, reschedule the unfinished tasks, review the proposal, and accept it. Confirm the old plan stays until you choose to replace it.
  Commit: `Add progress tracking and accepted rescheduling`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after Slice 1, so feedback can shape the plan and AI experience.
- [ ] Final kick-the-tires exploration and feedback completed — after Slice 4.

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: pending build completion.
Route and stops: pending finished application files.
Edit outcome: not yet applicable.
Reflection: pending learning wrap-up.
Activity mode: pending build mode choice.

## Revisions

- Scheduling regression repair verified: study sessions are preserved through plan save/restore, completed-session state resets when a task is reopened, and leftover Free time is capped at 15 minutes. The learner confirmed study sessions appear in the generated plan. `npm test` passed 6/6 cases; `npm run build` passed TypeScript and production build. Slice 1 remains unchecked pending its task edit/reload/delete learner check. Slice 2 remains unchecked pending its complete ordering, unscheduled-task, and 10-minute-break verification.
