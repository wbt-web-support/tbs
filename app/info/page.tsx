import { withProtectedContent } from "@/components/protected-content";

function InfoPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold mb-8">Command HQ & BPM Claims Spreadsheet Summary</h1>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">📊 1. CHQ DASHBOARD</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Provides a high-level overview of strategic business functions. Helps track responsibilities, performance metrics, and the current health of key areas.</p>
          <p><strong>Columns:</strong> Function, Discipline, Owner, Target, Actual, Status, Comments</p>
          <p><strong>Rows:</strong> 9</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">📆 2. CHQ Timeline</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Lays out the company's strategic roadmap by quarter, with themes, objectives, and key milestones.</p>
          <p><strong>Columns:</strong> Quarter, Theme, Objectives, Key Milestones</p>
          <p><strong>Rows:</strong> 6</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">🚨 3. Triage Planner</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Identifies current business problems, uncovers root causes, and proposes action plans to resolve them.</p>
          <p><strong>Columns:</strong> Problem, Root Cause, Impact, Owner, Resolution Plan, Status</p>
          <p><strong>Rows:</strong> 6</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">⚔️ 4. Business Battle Plan</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Tracks key strategic initiatives across business categories with outcomes, ownership, and timelines.</p>
          <p><strong>Columns:</strong> Category, Initiative, Outcome, Owner, Due Date, Status</p>
          <p><strong>Rows:</strong> 6</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">🧑‍💼 5. Chain of Command</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Outlines the company's hierarchy, showing roles, responsibilities, and reporting relationships.</p>
          <p><strong>Columns:</strong> Role, Name, Reports To, Responsibility, Email, Phone</p>
          <p><strong>Rows:</strong> 10</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">🚀 6. Growth Machine Planner</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Plans and structures the company's growth strategy, including specific tactics, timelines, and owners.</p>
          <p><strong>Columns:</strong> Growth Driver, Strategy, Tactics, Owner, Timeline, Status</p>
          <p><strong>Rows:</strong> 6</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">📈 7. Growth Machine</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Analyzes lead generation and conversion performance to measure ROI of growth channels.</p>
          <p><strong>Columns:</strong> Lead Source, Conversion Rate, Revenue, CAC, ROI</p>
          <p><strong>Rows:</strong> 6</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">📚 8. Growth Engine Library</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Central repository of marketing plays and tactics categorized by channel.</p>
          <p><strong>Columns:</strong> Play, Channel, Description, Owner, Status</p>
          <p><strong>Rows:</strong> 6</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">📦 9. Fulfilment Machine Planner</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Breaks down the fulfillment workflow into actionable steps with due dates and status updates.</p>
          <p><strong>Columns:</strong> Stage, Action, Owner, Due Date, Status</p>
          <p><strong>Rows:</strong> 6</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">📊 10. Fulfillment Machine</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Tracks performance metrics (KPIs) at each stage of the fulfillment pipeline.</p>
          <p><strong>Columns:</strong> Stage, KPI, Target, Actual, Owner</p>
          <p><strong>Rows:</strong> 6</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">🛠️ 11. Fulfillment Engine Library</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Documents tools, templates, and tactics used during fulfillment for efficiency and consistency.</p>
          <p><strong>Columns:</strong> Play, Tool, Description, Owner, Status</p>
          <p><strong>Rows:</strong> 6</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">📘 12. Playbook Planner</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Manages development and implementation of internal playbooks for key processes.</p>
          <p><strong>Columns:</strong> Playbook Name, Purpose, Owner, Due Date, Status</p>
          <p><strong>Rows:</strong> 6</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">📏 13. Company Scorecard</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Consolidated tracking of core company metrics and KPI ownership.</p>
          <p><strong>Columns:</strong> Metric, Target, Actual, Owner, Frequency</p>
          <p><strong>Rows:</strong> 6</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">🕒 14. Meeting Rhythm Planner 2526</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Standardizes meeting cadence and responsibilities across the team.</p>
          <p><strong>Columns:</strong> Meeting, Frequency, Participants, Purpose, Owner</p>
          <p><strong>Rows:</strong> 6</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">🏁 15. Quarterly Sprint Canvas</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Tracks quarterly goals (OKRs) including progress and team accountability.</p>
          <p><strong>Columns:</strong> Objective, Key Result, Owner, Progress, Comments</p>
          <p><strong>Rows:</strong> 6</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">📅 16. 12Q Planner</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Maps strategic initiatives over 12 quarters (3-year outlook).</p>
          <p><strong>Columns:</strong> Quarter, Theme, Objective, Initiatives, Owner</p>
          <p><strong>Rows:</strong> 12</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">🧭 17. HWGT Plan</h2>
        <div className="bg-muted p-4 rounded-lg">
          <p><strong>Purpose:</strong> Long-term strategic plan focused on alignment between goals and purpose.</p>
          <p><strong>Columns:</strong> Area, Goal, Why, Owner, Timeline, Status</p>
          <p><strong>Rows:</strong> 6</p>
        </div>
      </section>
    </div>
  );
}

export default InfoPage; 