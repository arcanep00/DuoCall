import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ApiError } from '../types';
import { AxiosError } from 'axios';

interface RegisterForm {
  username: string;
  email: string;
  display_name: string;
  password: string;
  password2: string;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterForm>({
    username: '',
    email: '',
    display_name: '',
    password: '',
    password2: '',
  });
  const [errors, setErrors] = useState<ApiError>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Client-side password match check
    if (form.password !== form.password2) {
      setErrors({ password2: 'Passwords do not match.' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    try {
      await register(form);
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

  const fields: Array<{ name: keyof RegisterForm; label: string; type: string; autoComplete: string }> = [
    { name: 'username',     label: 'Username',         type: 'text',     autoComplete: 'username' },
    { name: 'email',        label: 'Email',             type: 'email',    autoComplete: 'email' },
    { name: 'display_name', label: 'Display Name',      type: 'text',     autoComplete: 'nickname' },
    { name: 'password',     label: 'Password',          type: 'password', autoComplete: 'new-password' },
    { name: 'password2',    label: 'Confirm Password',  type: 'password', autoComplete: 'new-password' },
  ];

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="logo">DuoCall</h1>
          <p className="subtitle">Create your account</p>
        </div>

        {errors.non_field_errors && (
          <p className="error-banner" role="alert">
            {errors.non_field_errors}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {fields.map(({ name, label, type, autoComplete }) => (
            <div className="field" key={name}>
              <label htmlFor={name}>{label}</label>
              <input
                id={name}
                name={name}
                type={type}
                autoComplete={autoComplete}
                value={form[name]}
                onChange={handleChange}
                required={name !== 'display_name'}
                aria-describedby={errors[name] ? `${name}-error` : undefined}
              />
              {errors[name] && (
                <span id={`${name}-error`} className="field-error">
                  {errors[name]}
                </span>
              )}
            </div>
          ))}

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
