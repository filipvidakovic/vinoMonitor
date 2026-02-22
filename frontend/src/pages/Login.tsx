import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login({ email, password });
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Login failed');
    }
    
    setLoading(false);
  };

  return (
    <div style={{ padding: '50px', maxWidth: '400px', margin: '0 auto' }}>
      <h1>Login</h1>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            style={{ width: '100%', padding: '10px', margin: '10px 0' }}
          />
        </div>
        <div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            style={{ width: '100%', padding: '10px', margin: '10px 0' }}
          />
        </div>
        <div>
            <button type="submit" disabled={loading} style={{ padding: '10px 20px', marginRight: '10px' }}>
            {loading ? 'Loading...' : 'Login'}
            </button>
            <button type="button" disabled={loading} style={{ padding: '10px 20px' }} onClick={() => navigate('/register')}>
            {loading ? 'Loading...' : 'Register'}
            </button>
        </div>
      </form>
      <p style={{ marginTop: '20px', fontSize: '14px' }}>
        Demo: admin@vinomonitor.rs / admin123456
      </p>
    </div>
  );
};

export default Login;