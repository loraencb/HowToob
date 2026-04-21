import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { validateEmail, validatePassword } from '../utils/validators'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import ErrorMessage from '../components/common/ErrorMessage'
import styles from './Login.module.css'

export default function Login() {
  const { login, authError, clearAuthError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Redirect to intended page after login, or home by default
  const from = location.state?.from?.pathname || '/'

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(field) {
    return (e) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
      // Clear field error on change
      if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
      if (serverError) setServerError('')
      if (authError) clearAuthError()
    }
  }

  function validate() {
    const errs = {}
    const emailErr = validateEmail(form.email)
    const passErr = validatePassword(form.password)
    if (emailErr) errs.email = emailErr
    if (passErr) errs.password = passErr
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setLoading(true)
    setServerError('')
    clearAuthError()
    try {
      await login(form.email, form.password)
      navigate(from, { replace: true })
    } catch (err) {
      if (err?.code === 'NETWORK_ERROR') {
        setServerError(
          'Could not reach HowToob from this device. Check that the host machine is on and the connection address is correct.'
        )
      } else if (err?.status === 401) {
        setServerError('Login failed. Please check your email and password.')
      } else {
        setServerError(err.message || 'Login failed. Please check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <Link to="/" className={styles.logo} aria-label="HowToob home">
          <span className={styles.logoMark}>H</span>
          <span className={styles.logoText}>HowToob</span>
        </Link>

        <h1 className={styles.heading}>Welcome back</h1>
        <p className={styles.subheading}>Log in to continue your learning journey</p>

        {serverError && (
          <ErrorMessage message={serverError} className={styles.serverError} />
        )}

        {!serverError && authError ? (
          <ErrorMessage message={authError} className={styles.serverError} />
        ) : null}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <Input
            id="email"
            label="Email address"
            type="email"
            value={form.email}
            onChange={handleChange('email')}
            error={errors.email}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <div className={styles.passwordWrapper}>
            <Input
              id="password"
              label="Password"
              type="password"
              value={form.password}
              onChange={handleChange('password')}
              error={errors.password}
              placeholder="Your password"
              autoComplete="current-password"
              required
            />
            <Link to="/forgot-password" className={styles.forgotLink}>
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log in'}
          </Button>
        </form>

        <p className={styles.switchText}>
          Don&apos;t have an account?{' '}
          <Link to="/register" className={styles.switchLink}>
            Create one, it&apos;s free
          </Link>
        </p>
      </div>
    </div>
  )
}
