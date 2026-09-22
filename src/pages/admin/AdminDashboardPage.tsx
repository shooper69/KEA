import { isActiveMemoryItem } from '../../architecture/vocabularyMemory'
import { PLACEHOLDER_USERS, PLACEHOLDER_VOCABULARY } from '../../data/placeholders'

export function AdminDashboardPage() {
  const activeVocabulary = PLACEHOLDER_VOCABULARY.filter(isActiveMemoryItem)
    .length

  return (
    <div className="admin-page">
      <h1>Dashboard</h1>
      <p className="admin-page__lede">
        Placeholder overview. Authentication is not implemented.
      </p>
      <div className="admin-stat-grid">
        <article className="admin-stat">
          <p className="admin-stat__label">Users</p>
          <p className="admin-stat__value">{PLACEHOLDER_USERS.length}</p>
        </article>
        <article className="admin-stat">
          <p className="admin-stat__label">Active vocabulary</p>
          <p className="admin-stat__value">{activeVocabulary}</p>
        </article>
        <article className="admin-stat">
          <p className="admin-stat__label">Languages</p>
          <p className="admin-stat__value">3</p>
        </article>
      </div>
    </div>
  )
}
