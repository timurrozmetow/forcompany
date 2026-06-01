import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import Modal from './Modal';

/**
 * Single-text-field modal used for create-folder and rename flows.
 * onSubmit(value) should return a promise; errors are shown inline.
 */
export default function InputModal({
  open,
  onClose,
  onSubmit,
  title,
  label,
  initialValue = '',
  confirmLabel,
  placeholder,
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError('');
      setLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 60);
    }
  }, [open, initialValue]);

  const submit = async () => {
    if (!value.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onSubmit(value.trim());
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error?.message || err?.message || t('toast.error'));
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={loading || !value.trim()}>
            {loading ? <Loader2 size={16} className="spin" /> : confirmLabel || t('common.save')}
          </button>
        </>
      }
    >
      <div className="field" style={{ marginBottom: error ? 8 : 0 }}>
        {label && <label>{label}</label>}
        <input
          ref={inputRef}
          className="input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      {error && (
        <div className="login-error" style={{ marginBottom: 0 }}>
          {error}
        </div>
      )}
    </Modal>
  );
}
