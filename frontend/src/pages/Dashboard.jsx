import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('normal');
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      navigate('/');
      return;
    }

    setSession(data.session);

    const headers = {
      Authorization: `Bearer ${data.session.access_token}`
    };

    const me = await api.get('/auth/me', { headers });
    setProfile(me.data.profile);

    const todoRes = await api.get('/todos', { headers });
    setTodos(todoRes.data.todos || []);
  }

  async function addTodo() {
    if (!title.trim()) return;

    const headers = {
      Authorization: `Bearer ${session.access_token}`
    };

    try {
      await api.post('/todos', { title, priority }, { headers });
      setTitle('');
      setPriority('normal');
      init();
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating todo');
    }
  }

  async function toggleTodo(todo) {
    const headers = {
      Authorization: `Bearer ${session.access_token}`
    };

    await api.put(`/todos/${todo.id}`, { completed: !todo.completed }, { headers });
    init();
  }

  async function deleteTodo(id) {
    const headers = {
      Authorization: `Bearer ${session.access_token}`
    };

    await api.delete(`/todos/${id}`, { headers });
    init();
  }

  async function upgradePremium() {
    const headers = {
      Authorization: `Bearer ${session.access_token}`
    };

    const { data } = await api.post('/payments/create-order', {}, { headers });

    const options = {
      key: data.key,
      amount: data.order.amount,
      currency: data.order.currency,
      name: 'Todo Premium',
      description: 'Premium Upgrade',
      order_id: data.order.id,
      handler: async function () {
        await api.post('/payments/verify', {}, { headers });
        alert('Premium activated');
        init();
      },
      theme: { color: '#3399cc' }
    };

    const razor = new window.Razorpay(options);
    razor.open();
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate('/');
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'Arial' }}>
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      <h2>Todo Dashboard</h2>
      <p>Plan: <b>{profile?.role || 'free'}</b></p>
      {profile?.role !== 'premium' && (
        <button onClick={upgradePremium} style={{ marginBottom: 20 }}>
          Upgrade to Premium
        </button>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter task"
          style={{ flex: 1, padding: 10 }}
        />
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
        <button onClick={addTodo}>Add</button>
      </div>

      {todos.map((todo) => (
        <div
          key={todo.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: 12,
            border: '1px solid #ccc',
            marginBottom: 10,
            background: todo.completed ? '#e8ffe8' : '#fff'
          }}
        >
          <div>
            <b>{todo.title}</b> - {todo.priority}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => toggleTodo(todo)}>
              {todo.completed ? 'Undo' : 'Done'}
            </button>
            <button onClick={() => deleteTodo(todo.id)}>Delete</button>
          </div>
        </div>
      ))}

      <button onClick={logout}>Logout</button>
    </div>
  );
}
