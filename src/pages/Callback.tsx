import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useServices, type Notice } from '../app/services'
import { LoginError } from '../spotify/auth'

/** Where Spotify sends the user back after login. Finishes the login and moves on. */
export function Callback() {
  const { auth } = useServices()
  const navigate = useNavigate()
  const { search } = useLocation()
  // The code can be exchanged only once, so ignore StrictMode's second effect run.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const params = new URLSearchParams(search)
    if (!auth) {
      navigate('/', { replace: true })
      return
    }
    auth.completeLogin(params).then(
      () => navigate('/mix', { replace: true }),
      (error: unknown) => {
        const notice: Notice = error instanceof LoginError ? error.reason : 'failed'
        navigate('/', { replace: true, state: { notice } })
      },
    )
  })

  return (
    <main className="page">
      <p className="muted" role="status">
        Logging you in…
      </p>
    </main>
  )
}
