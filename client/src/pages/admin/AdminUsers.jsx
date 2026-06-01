import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, Pencil, KeyRound, Ban, CircleCheck, Trash2, Shield, Loader2 } from 'lucide-react';

import { adminApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDateTime, initials } from '../../utils/format';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { TableSkeleton } from '../../components/Skeleton';

function UserFormModal({ open, onClose, onSaved, editing }) {
  const { t } = useTranslation();
  const toast = useToast();
  const isEdit = !!editing;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setUsername(editing?.username || '');
      setPassword('');
      setRole(editing?.role || 'user');
      setIsActive(editing ? editing.isActive : true);
      setError('');
      setSaving(false);
    }
  }, [open, editing]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await adminApi.updateUser(editing.id, { username, role, isActive });
        toast.success(t('toast.userUpdated'));
      } else {
        await adminApi.createUser({ username, password, role });
        toast.success(t('toast.userCreated'));
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error?.message || t('toast.error'));
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('admin.editUser') : t('admin.createUser')}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={saving || !username.trim() || (!isEdit && !password)}
          >
            {saving ? <Loader2 size={16} className="spin" /> : t('common.save')}
          </button>
        </>
      }
    >
      <div className="field">
        <label>{t('auth.username')}</label>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      {!isEdit && (
        <div className="field">
          <label>{t('auth.password')}</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      )}
      <div className="field">
        <label>{t('admin.role')}</label>
        <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="user">{t('admin.roleUser')}</option>
          <option value="admin">{t('admin.roleAdmin')}</option>
        </select>
      </div>
      {isEdit && (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{t('admin.status')}</label>
          <select className="select" value={isActive ? '1' : '0'} onChange={(e) => setIsActive(e.target.value === '1')}>
            <option value="1">{t('admin.active')}</option>
            <option value="0">{t('admin.blocked')}</option>
          </select>
        </div>
      )}
      {error && <div className="login-error" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>}
    </Modal>
  );
}

function PasswordModal({ open, onClose, user }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPassword('');
      setError('');
      setSaving(false);
    }
  }, [open]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await adminApi.changePassword(user.id, password);
      toast.success(t('toast.passwordChanged'));
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error?.message || t('toast.error'));
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t('admin.changePassword')} — ${user?.username || ''}`}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !password}>
            {saving ? <Loader2 size={16} className="spin" /> : t('common.save')}
          </button>
        </>
      }
    >
      <div className="field" style={{ marginBottom: 0 }}>
        <label>{t('admin.newPassword')}</label>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && password && save()}
        />
      </div>
      {error && <div className="login-error" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>}
    </Modal>
  );
}

export default function AdminUsers() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('tr') ? 'tr' : 'ru';
  const { user: me } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pwdUser, setPwdUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await adminApi.users());
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleBlock = async (u) => {
    try {
      await adminApi.setBlocked(u.id, u.isActive); // if active -> block(true)
      toast.success(t('toast.userUpdated'));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await adminApi.deleteUser(deleteUser.id);
      toast.success(t('toast.userDeleted'));
      setDeleteUser(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          {t('admin.users')}
        </h1>
        <div className="grow" />
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <UserPlus size={18} /> {t('admin.newUser')}
        </button>
      </div>

      <div className="panel table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('admin.user')}</th>
              <th>{t('admin.role')}</th>
              <th>{t('admin.status')}</th>
              <th>{t('admin.lastLogin')}</th>
              <th>{t('admin.createdAt')}</th>
              <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : (
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                        {initials(u.username)}
                      </div>
                      <span style={{ fontWeight: 560 }}>{u.username}</span>
                      {u.id === me?.id && <span className="badge badge-accent">you</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-accent' : ''}`}>
                      {u.role === 'admin' && <Shield size={12} />}
                      {u.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleUser')}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {u.isActive ? t('admin.active') : t('admin.blocked')}
                    </span>
                  </td>
                  <td className="muted tiny">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt, locale) : t('admin.never')}
                  </td>
                  <td className="muted tiny">{formatDateTime(u.createdAt, locale)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button
                        className="btn-icon"
                        title={t('common.edit')}
                        onClick={() => {
                          setEditing(u);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil size={17} />
                      </button>
                      <button className="btn-icon" title={t('admin.changePassword')} onClick={() => setPwdUser(u)}>
                        <KeyRound size={17} />
                      </button>
                      <button
                        className="btn-icon"
                        title={u.isActive ? t('admin.block') : t('admin.unblock')}
                        onClick={() => toggleBlock(u)}
                        disabled={u.id === me?.id}
                      >
                        {u.isActive ? (
                          <Ban size={17} style={{ color: 'var(--warning)' }} />
                        ) : (
                          <CircleCheck size={17} style={{ color: 'var(--success)' }} />
                        )}
                      </button>
                      <button
                        className="btn-icon"
                        title={t('common.delete')}
                        onClick={() => setDeleteUser(u)}
                        disabled={u.id === me?.id}
                      >
                        <Trash2 size={17} style={{ color: 'var(--danger)' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      <UserFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} editing={editing} />
      <PasswordModal open={!!pwdUser} onClose={() => setPwdUser(null)} user={pwdUser} />
      <ConfirmDialog
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={confirmDelete}
        title={t('common.delete')}
        message={`${deleteUser?.username} — ${t('admin.deleteUserConfirm')}`}
        confirmLabel={t('common.delete')}
        danger
        loading={busy}
      />
    </div>
  );
}
