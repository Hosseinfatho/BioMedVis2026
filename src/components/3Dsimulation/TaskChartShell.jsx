export default function TaskChartShell({ title, question, why, children }) {
  return (
    <section className="task-chart">
      <h4 className="task-chart-title">{title}</h4>
      <p className="task-chart-question">{question}</p>
      <p className="task-chart-why">{why}</p>
      <div className="task-chart-body">{children}</div>
    </section>
  );
}
