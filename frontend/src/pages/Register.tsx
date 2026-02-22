import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import type { RegisterRequest } from '../types';

const Register: React.FC = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterRequest>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'worker',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.register(form);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user');
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: '50px', maxWidth: '400px', margin: '0 auto' }}>
      <h1>Create User</h1>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <input
          name="first_name"
          placeholder="First Name"
          value={form.first_name}
          onChange={handleChange}
          required
          style={{ width: '100%', padding: '10px', margin: '10px 0' }}
        />

        <input
          name="last_name"
          placeholder="Last Name"
          value={form.last_name}
          onChange={handleChange}
          required
          style={{ width: '100%', padding: '10px', margin: '10px 0' }}
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
          style={{ width: '100%', padding: '10px', margin: '10px 0' }}
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
          style={{ width: '100%', padding: '10px', margin: '10px 0' }}
        />

        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          style={{ width: '100%', padding: '10px', margin: '10px 0' }}
        >
          <option value="worker">Worker</option>
          <option value="winemaker">Winemaker</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: '10px 20px', width: '100%' }}
        >
          {loading ? 'Creating...' : 'Create User'}
        </button>
      </form>
    </div>
  );
};

export default Register;