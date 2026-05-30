// ProductFieldEditor — lets event creators define custom fields on a product.
// A field can be free text or a select (dropdown with predefined options).
//
// Props:
//   fields      — array of field objects (the current state)
//   onChange    — called with the updated fields array whenever something changes

function newField() {
  return {
    id: Math.random().toString(36).slice(2, 9),
    label: '',
    type: 'text',
    options: [],
    required: false
  };
}

export default function ProductFieldEditor({ fields = [], onChange }) {
  const update = (index, patch) => {
    const updated = fields.map((f, i) => i === index ? { ...f, ...patch } : f);
    onChange(updated);
  };

  const addField = () => onChange([...fields, newField()]);

  const removeField = (index) => onChange(fields.filter((_, i) => i !== index));

  const addOption = (index) => {
    const updated = [...fields[index].options, ''];
    update(index, { options: updated });
  };

  const updateOption = (fieldIndex, optionIndex, value) => {
    const options = fields[fieldIndex].options.map((o, i) => i === optionIndex ? value : o);
    update(fieldIndex, { options });
  };

  const removeOption = (fieldIndex, optionIndex) => {
    const options = fields[fieldIndex].options.filter((_, i) => i !== optionIndex);
    update(fieldIndex, { options });
  };

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <p style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
        Custom fields
      </p>

      {fields.map((field, i) => (
        <div key={field.id} style={{
          background: 'var(--surface-3)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '0.75rem',
          marginBottom: '0.5rem'
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.72rem' }}>Label</label>
              <input
                value={field.label}
                onChange={e => update(i, { label: e.target.value })}
                placeholder="e.g. Allergies, Size"
                style={{ marginBottom: 0 }}
              />
            </div>
            <div style={{ width: 110 }}>
              <label style={{ fontSize: '0.72rem' }}>Type</label>
              <select
                value={field.type}
                onChange={e => update(i, { type: e.target.value, options: e.target.value === 'select' ? [''] : [] })}
                style={{ marginBottom: 0 }}
              >
                <option value="text">Free text</option>
                <option value="select">Dropdown</option>
              </select>
            </div>
            <div style={{ paddingTop: '1.4rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 0, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={e => update(i, { required: e.target.checked })}
                  style={{ width: 'auto', margin: 0 }}
                />
                Required
              </label>
            </div>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => removeField(i)}
              style={{ marginTop: '1.4rem', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
            >
              ✕
            </button>
          </div>

          {field.type === 'select' && (
            <div style={{ marginTop: '0.4rem' }}>
              <label style={{ fontSize: '0.72rem' }}>Options</label>
              {field.options.map((opt, j) => (
                <div key={j} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.3rem' }}>
                  <input
                    value={opt}
                    onChange={e => updateOption(i, j, e.target.value)}
                    placeholder={`Option ${j + 1}`}
                    style={{ marginBottom: 0, flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => removeOption(i, j)}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => addOption(i)}
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', marginTop: '0.2rem' }}
              >
                + Add option
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        className="btn btn-secondary"
        onClick={addField}
        style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}
      >
        + Add field
      </button>
    </div>
  );
}
