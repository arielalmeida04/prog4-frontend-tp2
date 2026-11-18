import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage } from '../types'
import type { ApiErrorBody, User } from '../types'
import UserDetail from './UserDetail'
import UserForm from './UserForm'

interface Props {
  token: string
  onUnauthorized: () => void
}

export default function UserList({ token, onUnauthorized }: Props) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Práctica 1: guardamos el id elegido y el detalle depende de él
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // Práctica 3: búsqueda por nombre
  const [searchInput, setSearchInput] = useState('')
  // Práctica 6: alternar entre todos y solo mayores
  const [onlyAdults, setOnlyAdults] = useState(false)
  // Se incrementa después de un alta para volver a pedir la lista sin recargar la página
  const [refreshKey, setRefreshKey] = useState(0)
  // Práctica 7: mensaje del 403 al intentar borrar
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      setLoading(true)
      setError(null)
      try {
        const path = onlyAdults ? 'user_mayores' : 'user'
        const response = await fetch(`${import.meta.env.VITE_API_URL}/${path}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (cancelled) return
        if (response.status === 401) {
          onUnauthorized()
          return
        }
        if (!response.ok) {
          const body: ApiErrorBody | null = await response.json().catch(() => null)
          throw new Error(errorMessage(body, `Error ${response.status}`))
        }
        const data: User[] = await response.json()
        if (!cancelled) setUsers(data)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Error inesperado')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadUsers()
    return () => {
      cancelled = true
    }
  }, [onlyAdults, refreshKey, token, onUnauthorized])

  // Práctica 3: GET /user/search/{name} con encodeURIComponent
  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = searchInput.trim()
    if (!name) return

    setLoading(true)
    setError(null)
    setSelectedId(null)
    setDeleteError(null)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/user/search/${encodeURIComponent(name)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (response.status === 401) {
        onUnauthorized()
        return
      }
      if (!response.ok) {
        const body: ApiErrorBody | null = await response.json().catch(() => null)
        throw new Error(errorMessage(body, `Error ${response.status}`))
      }
      const data: User[] = await response.json()
      setUsers(data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  // Práctica 3: Limpiar vuelve a la lista completa
  function handleClear() {
    setSearchInput('')
    setOnlyAdults(false)
    setSelectedId(null)
    setDeleteError(null)
    setRefreshKey((key) => key + 1)
  }

  // Práctica 7: DELETE /user/{id} con confirmación y filter
  async function handleDelete(id: number, name: string) {
    const confirmed = window.confirm(`¿Borrar a ${name}?`)
    if (!confirmed) return

    setDeleteError(null)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/user/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status === 401) {
        onUnauthorized()
        return
      }
      if (!response.ok) {
        const body: ApiErrorBody | null = await response.json().catch(() => null)
        setDeleteError(errorMessage(body, `Error ${response.status} al borrar`))
        return
      }
      setUsers((previous) => previous.filter((user) => user.id !== id))
      if (selectedId === id) setSelectedId(null)
    } catch {
      setDeleteError('Error de red al borrar el usuario')
    }
  }

  return (
    <section className="layout">
      <div className="card list">
        <div className="toolbar">
          <form className="search" onSubmit={handleSearch}>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nombre"
              aria-label="Buscar por nombre"
            />
            <button type="submit">Buscar</button>
            <button type="button" className="secondary" onClick={handleClear}>
              Limpiar
            </button>
          </form>
          <button type="button" className="secondary" onClick={() => setOnlyAdults((value) => !value)}>
            {onlyAdults ? 'Ver todos' : 'Solo mayores'}
          </button>
        </div>

        <UserForm
          token={token}
          onUnauthorized={onUnauthorized}
          onCreated={() => setRefreshKey((key) => key + 1)}
        />

        {deleteError && <p className="alert error">{deleteError}</p>}

        {loading && <p className="muted">Cargando...</p>}

        {!loading && error && <p className="alert error">{error}</p>}

        {!loading && !error && (
          <table className="users">
            <thead>
              <tr>
                <th>Nombre</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className={user.id === selectedId ? 'selected' : undefined}>
                  <td>
                    <button type="button" className="link" onClick={() => setSelectedId(user.id)}>
                      {user.name}
                    </button>
                  </td>
                  <td className="right">
                    <button
                      type="button"
                      className="danger"
                      onClick={() => handleDelete(user.id, user.name)}
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={2} className="muted">
                    No hay usuarios para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selectedId !== null && (
        <UserDetail
          id={selectedId}
          token={token}
          onUnauthorized={onUnauthorized}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  )
}
