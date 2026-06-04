/**
 * RegistrationReview - Shows a summary of selected products before proceeding to checkout
 * Allows user to review and confirm their selections
 */

export default function RegistrationReview({
  products,
  eventTitle,
  teamName,
  comments,
  totalAmount,
  onConfirm,
  onCancel
}) {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Review Your Registration</h3>

        {/* Event info */}
        <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
          <p style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>
            <strong>Event:</strong> {eventTitle}
          </p>
          {teamName && (
            <p style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>
              <strong>Team:</strong> {teamName}
            </p>
          )}
        </div>

        {/* Products */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.8rem', color: '#333' }}>Selected Products</h4>
          <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
            {products.map((p, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.8rem 1rem',
                  borderBottom: idx < products.length - 1 ? '1px solid var(--border)' : 'none',
                  background: idx % 2 === 0 ? 'transparent' : 'var(--surface-2)'
                }}
              >
                <div>
                  <strong>{p.name}</strong>
                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    × {p.quantity}
                  </span>
                </div>
                <span style={{ fontWeight: 600, color: '#333' }}>
                  €{(p.price * p.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Comments */}
        {comments && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--surface-2)', borderRadius: '6px' }}>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <strong>Additional Comments:</strong>
            </p>
            <p style={{ margin: 0, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
              {comments}
            </p>
          </div>
        )}

        {/* Total */}
        <div style={{
          background: 'linear-gradient(135deg, var(--accent) 0%, #0052a3 100%)',
          color: 'white',
          padding: '1.5rem',
          borderRadius: '6px',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', opacity: 0.9 }}>Total Amount</p>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>
            €{totalAmount.toFixed(2)}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <button
            onClick={onConfirm}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            Proceed to Payment
          </button>
          <button
            onClick={onCancel}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
