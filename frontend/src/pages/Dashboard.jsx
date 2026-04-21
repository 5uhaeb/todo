import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import api from '../api/axios';
import ThemeToggle from '../components/ThemeToggle.jsx';

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

  useEffect(() => { init(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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
      showToast('Task added');
      init();
    } catch (error) {
      showToast(error.response?.data?.message || 'Could not create task', 'error');
    } finally {
      setAdding(false);
    }
  }

  async function toggleTodo(todo) {
    try {
      await api.put(`/todos/${todo.id}`, { completed: !todo.completed }, { headers: getHeaders() });
      showToast(todo.completed ? 'Task reopened' : 'Task completed');
      init();
    } catch (err) {
      showToast('Could not update task', 'error');
    }
  }

  async function deleteTodo(id) {
    try {
      await api.delete(`/todos/${id}`, { headers: getHeaders() });
      showToast('Task deleted');
      init();
    } catch (err) {
      showToast('Could not delete task', 'error');
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
        description: 'Unlock unlimited tasks and high priority',
        order_id: data.order.id,
        handler: async function (response) {
          try {
            await api.post('/payments/verify', {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            }, { headers: getHeaders() });
            showToast('Premium activated');
            init();
          } catch (error) {
            showToast(error.response?.data?.message || 'Payment verification failed', 'error');
          }
        },
        theme: { color: '#0f5d3c' }
      };
      const razor = new window.Razorpay(options);
      razor.open();
    } catch (err) {
      showToast('Could not create order', 'error');
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
      <div className="loading-page">
        <div className="loading-spinner" />
        <p style={{ marginTop: 16 }}>Loading your tasks...</p>
        <style>{loadingCss}</style>
      </div>
    );
  }

  return (
    <div className="dash-page">
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {toast.message}
        </div>
      )}

      <header className="dash-header">
        <div className="dash-brand">
          <span className="brand-square">T</span>
          <span className="brand-name">Taskflow</span>
        </div>
        <div className="dash-actions">
          <span className={`badge ${isPremium ? 'badge-premium' : 'badge-free'}`}>
            {isPremium ? 'Premium' : 'Free'}
          </span>
          <ThemeToggle />
          <button id="logout-btn" className="btn btn-sm" onClick={logout}>
            <IconLogout /> Logout
          </button>
        </div>
      </header>

      <main className="dash-main">
        {!isPremium && (
          <div className="card animate-fade-in upgrade-card">
            <div>
              <h3 style={{ marginBottom: 4 }}>Unlock premium</h3>
              <p>Unlimited tasks, high priority, and more.</p>
            </div>
            <button id="upgrade-btn" className="btn btn-amber" onClick={upgradePremium}>
              Upgrade - Rs 99
            </button>
          </div>
        )}

        <div className="stats-row animate-fade-in">
          <div className="card-sm stat-card">
            <span className="stat-num">{stats.total}</span>
            <span className="label-tag">Total</span>
          </div>
          <div className="card-sm stat-card">
            <span className="stat-num" style={{ color: 'var(--blue)' }}>{stats.active}</span>
            <span className="label-tag">Active</span>
          </div>
          <div className="card-sm stat-card">
            <span className="stat-num" style={{ color: 'var(--green)' }}>{stats.completed}</span>
            <span className="label-tag">Done</span>
          </div>
        </div>

        <form onSubmit={addTodo} className="card add-form animate-fade-in">
          <div className="add-row">
            <input
              id="task-input"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              style={{ flex: 1, minWidth: 200 }}
            />
            <select
              id="priority-select"
              className="select"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={{ width: 130 }}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
            <button id="add-task-btn" type="submit" className="btn btn-primary" disabled={adding || !title.trim()}>
              {adding ? '...' : 'Add task'}
            </button>
          </div>
        </form>

        <div className="filter-row animate-fade-in">
          {['all', 'active', 'completed'].map((f) => (
            <button
              key={f}
              type="button"
              className={`btn btn-sm ${filter === f ? 'btn-primary' : ''}`}
              onClick={() => setFilter(f)}
              style={{ textTransform: 'capitalize' }}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="task-list">
          {filteredTodos.length === 0 ? (
            <div className="empty-state animate-fade-in">
              <IconCheckSquare />
              <p>
                {filter === 'all' ? 'No tasks yet. Add one above.' : `No ${filter} tasks.`}
              </p>
            </div>
          ) : (
            filteredTodos.map((todo, i) => (
              <div
                key={todo.id}
                className={`row-item animate-slide-up ${todo.completed ? 'task-done' : ''}`}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <input
                  id={`toggle-${todo.id}`}
                  type="checkbox"
                  className="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo)}
                  aria-label={`Toggle ${todo.title}`}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className={`task-title ${todo.completed ? 'task-title-done' : ''}`}>
                    {todo.title}
                  </span>
                  <span className={`badge badge-${todo.priority}`} style={{ marginLeft: 8 }}>
                    {todo.priority}
                  </span>
                </div>
                <button
                  id={`delete-${todo.id}`}
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => deleteTodo(todo.id)}
                  aria-label="Delete task"
                >
                  <IconTrash />
                </button>
              </div>
            ))
          )}
        </div>
      </main>

      <style>{`
        .dash-page {
          min-height: 100vh;
          max-width: 760px;
          margin: 0 auto;
          padding: 0 20px 60px;
        }
        .dash-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 0 16px;
          margin-bottom: 24px;
          border-bottom: var(--outline-thin) solid var(--outline);
          flex-wrap: wrap;
          gap: 12px;
        }
        .dash-brand { display: flex; align-items: center; gap: 12px; }
        .brand-name { font-size: 1.125rem; font-weight: 700; letter-spacing: -0.01em; }
        .dash-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        .upgrade-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 20px;
          background: var(--surface-2);
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 18px;
        }
        .stat-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 14px;
        }
        .stat-num {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--ink);
          line-height: 1;
        }

        .add-form { margin-bottom: 18px; }
        .add-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .filter-row {
          display: flex;
          gap: 8px;
          margin-bottom: 14px;
        }

        .task-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .task-done { opacity: 0.65; }
        .task-title { font-weight: 600; color: var(--ink); }
        .task-title-done { text-decoration: line-through; color: var(--ink-mute); }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 60px 20px;
          color: var(--ink-mute);
        }
        ${loadingCss}
      `}</style>
    </div>
  );
}

const loadingCss = `
.loading-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--ink-soft);
}
.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--outline);
  border-top-color: var(--green);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
`;

function IconLogout() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function IconCheckSquare() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
