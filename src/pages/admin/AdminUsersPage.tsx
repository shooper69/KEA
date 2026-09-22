import { getLanguage } from '../../config/languages'
import { PLACEHOLDER_USERS } from '../../data/placeholders'

export function AdminUsersPage() {
  return (
    <div className="admin-page">
      <h1>Users</h1>
      <p className="admin-page__lede">Placeholder directory. No registration.</p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Language</th>
              <th>Active vocabulary</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_USERS.map((user) => (
              <tr key={user.id}>
                <td>{user.displayName}</td>
                <td>{getLanguage(user.languageCode).name}</td>
                <td>{user.activeVocabularyCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
