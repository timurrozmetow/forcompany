export function GridSkeleton({ count = 12 }) {
  return (
    <div className="grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="tile" style={{ cursor: 'default' }}>
          <div className="skel" style={{ height: 92 }} />
          <div className="skel" style={{ height: 12, width: '80%' }} />
          <div className="skel" style={{ height: 10, width: '50%' }} />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 8 }) {
  return (
    <div className="list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="list-row" style={{ cursor: 'default' }}>
          <div className="list-name">
            <div className="skel" style={{ width: 28, height: 28, borderRadius: 8 }} />
            <div className="skel" style={{ height: 12, width: '40%' }} />
          </div>
          <div className="skel list-cell" style={{ height: 10 }} />
          <div className="skel list-cell" style={{ height: 10 }} />
          <div className="skel list-cell" style={{ height: 10 }} />
          <div />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c}>
              <div className="skel" style={{ height: 12, width: c === 0 ? '60%' : '40%' }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
