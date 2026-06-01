export default function EmptyState({ icon, title, hint }) {
  return (
    <div className="empty">
      {icon && <div className="emoji">{icon}</div>}
      <h3>{title}</h3>
      {hint && <p style={{ margin: 0, maxWidth: 360 }}>{hint}</p>}
    </div>
  );
}
