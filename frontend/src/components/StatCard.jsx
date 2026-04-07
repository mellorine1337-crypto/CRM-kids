export function StatCard(props) {
  const { icon: Icon, label, value, tone = "blue" } = props;

  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__icon">
        <Icon size={20} />
      </div>
      <div className="stat-card__body">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
