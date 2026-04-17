import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase.js';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('normal');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const getHeaders = useCallback(() => {
    if (!session) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  }, [session]);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { navigate('/'); return; }
      setSession(data.session);

      const headers = { Authorization: `Bearer ${data.session.access_token}` };
      const [me, todoRes] = await Promise.all([
        api.get('/auth/me', { headers }),
        api.get('/todos', { headers })
      ]);
      setProfile(me.data.profile);
      setTodos(todoRes.data.todos || []);
    } catch (err) {
      console.error('Init error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function addTodo(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    try {
      await api.post('/todos', { title, priority }, { headers: getHeaders() });
      setTitle('');
      setPriority('normal');
      showToast('Task added successfully');
      init();
    } catch (error) {
      showToast(error.response?.data?.message || 'Error creating task', 'error');
    } finally {
      setAdding(false);
    }
  }

  async function toggleTodo(todo) {
    try {
      await api.put(`/todos/${todo.id}`, { completed: !todo.completed }, { headers: getHeaders() });
      showToast(todo.completed ? 'Task reopened' : 'Task completed!');
      init();
    } catch (err) {
      showToast('Failed to update task', 'error');
    }
  }

  async function deleteTodo(id) {
    try {
      await api.delete(`/todos/${id}`, { headers: getHeaders() });
      showToast('Task deleted');
      init();
    } catch (err) {
      showToast('Failed to delete task', 'error');
    }
  }

  async function upgradePremium() {
    try {
      const { data } = await api.post('/payments/create-order', {}, { headers: getHeaders() });
      const options = {
        key: data.key,
        amount: data.order.amount,
        currency: data.order.currency,
        name: 'Taskflow Premium',
        description: 'Unlock unlimited tasks & high priority',
        order_id: data.order.id,
        handler: async function (response) {
          try {
            await api.post('/payments/verify', {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            }, { headers: getHeaders() });
            showToast('Premium activated! 🎉');
            init();
          } catch (error) {
            showToast(error.response?.data?.message || 'Payment verification failed', 'error');
          }
        },
        theme: { color: '#6c63ff' }
      };
      const razor = new window.Razorpay(options);
      razor.open();
    } catch (err) {
      showToast('Failed to create order', 'error');
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate('/');
  }

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const stats = {
    total: todos.length,
    completed: todos.filter(t => t.completed).length,
    active: todos.filter(t => !t.completed).length
  };

  const isPremium = profile?.role === 'premium';

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingSpinner} />
        <p style={{ color: '#9ca3af', marginTop: 16 }}>Loading your tasks...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          <span style={styles.logoName}>Taskflow</span>
        </div>
        <div style={styles.headerRight}>
          <span className={`badge ${isPremium ? 'badge-premium' : 'badge-free'}`}>
            {isPremium ? '★ Premium' : 'Free'}
          </span>
          <button id="logout-btn" className="btn btn-ghost btn-sm" onClick={logout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {/* Upgrade Banner */}
        {!isPremium && (
          <div style={styles.upgradeBanner} className="animate-fade-in">
            <div>
              <h3 style={styles.upgradeTitle}>⚡ Unlock Premium</h3>
              <p style={styles.upgradeDesc}>Get unlimited tasks, high priority, and more.</p>
            </div>
            <button id="upgrade-btn" className="btn btn-premium btn-sm" onClick={upgradePremium}>
              Upgrade — ₹99
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div style={styles.statsRow} className="animate-fade-in">
          <div style={styles.statCard}>
            <span style={styles.statNum}>{stats.total}</span>
            <span style={styles.statLabel}>Total</span>
          </div>
          <div style={styles.statCard}>
            <span style={{ ...styles.statNum, color: 'var(--priority-normal)' }}>{stats.active}</span>
            <span style={styles.statLabel}>Active</span>
          </div>
          <div style={styles.statCard}>
            <span style={{ ...styles.statNum, color: 'var(--success)' }}>{stats.completed}</span>
            <span style={styles.statLabel}>Done</span>
          </div>
        </div>

        {/* Add Task Form */}
        <form onSubmit={addTodo} style={styles.addForm} className="card animate-fade-in">
          <div style={styles.addRow}>
            <input
              id="task-input"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              style={{ flex: 1 }}
            />
            <select
              id="priority-select"
              className="select"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
            <button id="add-task-btn" type="submit" className="btn btn-primary" disabled={adding || !title.trim()}>
              {adding ? '...' : '+ Add'}
            </button>
          </div>
        </form>

        {/* Filter Tabs */}
        <div style={styles.filterRow} className="animate-fade-in">
          {['all', 'active', 'completed'].map((f) => (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(f)}
              style={{ textTransform: 'capitalize' }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Task List */}
        <div style={styles.taskList}>
          {filteredTodos.length === 0 ? (
            <div style={styles.emptyState} className="animate-fade-in">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
              <p style={styles.emptyText}>
                {filter === 'all' ? 'No tasks yet. Add one above!' : `No ${filter} tasks.`}
              </p>
            </div>
          ) : (
            filteredTodos.map((todo, i) => (
              <div
                key={todo.id}
                style={{
                  ...styles.taskCard,
                  ...(todo.completed ? styles.taskCompleted : {}),
                  animationDelay: `${i * 0.05}s`
                }}
                className="animate-slide-up"
              >
                <div style={styles.taskLeft}>
                  <button
                    id={`toggle-${todo.id}`}
                    onClick={() => toggleTodo(todo)}
                    style={{
                      ...styles.checkbox,
                      ...(todo.completed ? styles.checkboxDone : {}),
                    }}
                  >
                    {todo.completed && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    )}
                  </button>
                  <div>
                    <span style={{
                      ...styles.taskTitle,
                      ...(todo.completed ? styles.taskTitleDone : {}),
                    }}>
                      {todo.title}
                    </span>
                    <span className={`badge badge-${todo.priority}`} style={{ marginLeft: 8 }}>
                      {todo.priority}
                    </span>
                  </div>
                </div>
                <button
                  id={`delete-${todo.id}`}
                  className="btn btn-ghost btn-sm"
                  onClick={() => deleteTodo(todo.id)}
                  style={{ color: 'var(--text-muted)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

// ===== STYLES =====
const styles = {
  page: {
    minHeight: '100vh',
    maxWidth: '720px',
    margin: '0 auto',
    padding: '0 20px',
  },
  loadingPage: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(108,99,255,0.2)',
    borderTopColor: '#6c63ff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '28px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #6c63ff 0%, #a78bfa 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    boxShadow: '0 0 20px rgba(108,99,255,0.25)',
  },
  logoName: {
    fontSize: '1.25rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
    background: 'linear-gradient(135deg, #f0f0f5, #a78bfa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  main: {},
  upgradeBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(249,115,22,0.08) 100%)',
    border: '1px solid rgba(245,158,11,0.2)',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  upgradeTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#fbbf24',
    marginBottom: '2px',
  },
  upgradeDesc: {
    fontSize: '0.8125rem',
    color: '#d97706',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '24px',
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '14px',
  },
  statNum: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: '0.7rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginTop: '4px',
  },
  addForm: {
    marginBottom: '20px',
  },
  addRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  filterRow: {
    display: 'flex',
    gap: '6px',
    marginBottom: '16px',
  },
  taskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingBottom: '40px',
  },
  taskCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '14px',
    transition: 'all 250ms ease',
    opacity: 0,
    animationFillMode: 'forwards',
  },
  taskCompleted: {
    opacity: 0.6,
  },
  taskLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flex: 1,
    minWidth: 0,
  },
  checkbox: {
    width: '24px',
    height: '24px',
    borderRadius: '8px',
    border: '2px solid var(--border-input)',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 200ms ease',
    flexShrink: 0,
  },
  checkboxDone: {
    background: 'var(--success)',
    borderColor: 'var(--success)',
  },
  taskTitle: {
    fontSize: '0.9375rem',
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  taskTitleDone: {
    textDecoration: 'line-through',
    color: 'var(--text-muted)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '16px',
  },
  emptyText: {
    color: 'var(--text-muted)',
    fontSize: '0.9375rem',
  },
};
