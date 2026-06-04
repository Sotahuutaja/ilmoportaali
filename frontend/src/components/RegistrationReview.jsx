/**
 * RegistrationReview - Shows a summary of captain and guest registrations before checkout
 * Displays individual breakdowns for captain and each guest
 */

export default function RegistrationReview({
  products,
  eventTitle,
  teamName,
  comments,
  totalAmount,
  onConfirm,
  onCancel,
  captainName,
  guests
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

        {/* Products - Show captain and guests separately */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.8rem', color: '#333' }}>Registration Breakdown</h4>

          {/* Captain's products */}
          <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--surface-2)', borderRadius: '6px' }}>
            <p style={{ margin: '0 0 0.8rem 0', fontWeight: 600, fontSize: '0.95rem' }}>
              👤 {captainName || 'You (Captain)'} {teamName && `- Team: ${teamName}`}
            </p>
            <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              {products.map((p, idx) => {
                const subtotal = p.price * p.quantity;
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '0.6rem 0.8rem',
                      borderBottom: idx < products.length - 1 ? '1px solid var(--border)' : 'none',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                      <div>
                        <span style={{ fontSize: '0.9rem' }}>{p.name}</span>
                        <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          × {p.quantity}
                        </span>
                      </div>
                      <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                        €{subtotal.toFixed(2)}
                      </span>
                    </div>
                    {p.field_values && Object.keys(p.field_values).length > 0 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {Object.entries(p.field_values).map(([key, value]) => (
                          <div key={key}>{key}: <strong>{value}</strong></div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Guests' products */}
          {guests && guests.length > 0 && (
            guests.map((guest, gIdx) => {
              const guestProducts = guest.products || [];

              return (
                <div key={gIdx} style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--surface-2)', borderRadius: '6px' }}>
                  <p style={{ margin: '0 0 0.8rem 0', fontWeight: 600, fontSize: '0.95rem' }}>
                    👥 {guest.guest_first_name} {guest.guest_last_name}
                  </p>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                    {guestProducts.map((p, idx) => {
                      const subtotal = p.price * p.quantity;
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '0.6rem 0.8rem',
                            borderBottom: idx < guestProducts.length - 1 ? '1px solid var(--border)' : 'none',
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                            <div>
                              <span style={{ fontSize: '0.9rem' }}>{p.name}</span>
                              <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                × {p.quantity}
                              </span>
                            </div>
                            <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                              €{subtotal.toFixed(2)}
                            </span>
                          </div>
                          {p.field_values && Object.keys(p.field_values).length > 0 && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                              {Object.entries(p.field_values).map(([key, value]) => (
                                <div key={key}>{key}: <strong>{value}</strong></div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
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
