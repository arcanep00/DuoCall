import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ApiError } from '../types';
import { AxiosError } from 'axios';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState<ApiError>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    // Clear the error for this field when the user starts typing
    setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    try {
      await login(form);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const axiosErr = err as AxiosError<ApiError>;
      if (axiosErr.response?.data) {
        setErrors(axiosErr.response.data);
      } else {
        setErrors({ non_field_errors: 'Something went wrong. Please try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Logo / Title */}
        <div className="auth-header">
          <h1 className="logo">DuoCall</h1>
          <p className="subtitle">Sign in to your account</p>
        </div>

        {/* Global error */}
        {errors.non_field_errors && (
          <p className="error-banner" role="alert">
            {errors.non_field_errors}
          </p>
        )}
        {errors.detail && (
          <p className="error-banner" role="alert">
            {errors.detail}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={handleChange}
              required
              aria-describedby={errors.username ? 'username-error' : undefined}
            />
            {errors.username && (
              <span id="username-error" className="field-error">
                {errors.username}
              </span>
            )}
          </div>

          {/* Password */}
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              required
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            {errors.password && (
              <span id="password-error" className="field-error">
                {errors.password}
              </span>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="auth-footer">
          Don&apos;t have an account?{' '}
          <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
