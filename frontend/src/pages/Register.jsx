import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
  validateUsername,
} from '../utils/validators'
import { ROLES } from '../utils/constants'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import ErrorMessage from '../components/common/ErrorMessage'
import styles from './Register.module.css'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: ROLES.VIEWER,
    acceptTerms: false,
  })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(field) {
    return (e) => {
      const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm(prev => ({ ...prev, [field]: value }))
      if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
      if (serverError) setServerError('')
    }
  }

  function validate() {
    const errs = {}
    const usernameErr = validateUsername(form.username)
    const emailErr = validateEmail(form.email)
    const passErr = validatePassword(form.password)
    const confirmErr = validatePasswordConfirm(form.password, form.confirmPassword)

    if (usernameErr) errs.username = usernameErr
    if (emailErr) errs.email = emailErr
    if (passErr) errs.password = passErr
    if (confirmErr) errs.confirmPassword = confirmErr
    if (!form.acceptTerms) errs.acceptTerms = 'You must accept the terms to continue'
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
    try {
      await register(form.username, form.email, form.password, form.role)
      // Redirect to login with a success hint
      navigate('/login', { state: { registered: true } })
    } catch (err) {
      setServerError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isFormValid =
    form.username && form.email && form.password &&
    form.confirmPassword && form.acceptTerms &&
    !Object.values(errors).some(Boolean)

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <Link to="/" className={styles.logo} aria-label="HowToob home">
          <span className={styles.logoMark}>H</span>
          <span className={styles.logoText}>HowToob</span>
        </Link>

        <h1 className={styles.heading}>Start learning today</h1>
        <p className={styles.subheading}>Create your free account, no credit card needed</p>

        {serverError && (
          <ErrorMessage message={serverError} className={styles.serverError} />
        )}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <Input
            id="username"
            label="Username"
            type="text"
            value={form.username}
            onChange={handleChange('username')}
            error={errors.username}
            placeholder="your_username"
            autoComplete="username"
            required
          />

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

          <Input
            id="password"
            label="Password"
            type="password"
            value={form.password}
            onChange={handleChange('password')}
            error={errors.password}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            helperText="Minimum 8 characters"
            required
          />

          <Input
            id="confirmPassword"
            label="Confirm password"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange('confirmPassword')}
            error={errors.confirmPassword}
            placeholder="Repeat your password"
            autoComplete="new-password"
            required
          />

          {/* Role selection */}
          <fieldset className={styles.roleFieldset}>
            <legend className={styles.roleLabel}>I want to…</legend>
            <div className={styles.roleOptions}>
              <label
                className={`${styles.roleOption} ${form.role === ROLES.VIEWER ? styles.roleOptionSelected : ''}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={ROLES.VIEWER}
                  checked={form.role === ROLES.VIEWER}
                  onChange={handleChange('role')}
                  className={styles.radioInput}
                />
                <span className={styles.roleIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                </span>
                <div>
                  <span className={styles.roleTitle}>Learn</span>
                  <span className={styles.roleDesc}>Watch lessons, track progress</span>
                </div>
              </label>

              <label
                className={`${styles.roleOption} ${form.role === ROLES.CREATOR ? styles.roleOptionSelected : ''}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={ROLES.CREATOR}
                  checked={form.role === ROLES.CREATOR}
                  onChange={handleChange('role')}
                  className={styles.radioInput}
                />
                <span className={styles.roleIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                    <line x1="7" y1="2" x2="7" y2="22"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <line x1="2" y1="7" x2="7" y2="7"/>
                    <line x1="2" y1="17" x2="7" y2="17"/>
                    <line x1="12" y1="2" x2="12" y2="7"/>
                    <line x1="17" y1="2" x2="17" y2="7"/>
                  </svg>
                </span>
                <div>
                  <span className={styles.roleTitle}>Create</span>
                  <span className={styles.roleDesc}>Upload lessons, build courses</span>
                </div>
              </label>
            </div>
          </fieldset>

          {/* Terms checkbox */}
          <div className={styles.termsWrapper}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={form.acceptTerms}
                onChange={handleChange('acceptTerms')}
                className={styles.checkbox}
                aria-describedby={errors.acceptTerms ? 'terms-error' : undefined}
              />
              <span>
                I agree to the{' '}
                <Link to="/terms" className={styles.termsLink}>Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" className={styles.termsLink}>Privacy Policy</Link>
              </span>
            </label>
            {errors.acceptTerms && (
              <p id="terms-error" className={styles.termError} role="alert">
                {errors.acceptTerms}
              </p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            disabled={loading || !isFormValid}
          >
            {loading ? 'Creating account…' : 'Create free account'}
          </Button>
        </form>

        <p className={styles.switchText}>
          Already have an account?{' '}
          <Link to="/login" className={styles.switchLink}>Log in</Link>
        </p>
      </div>
    </div>
  )
}
