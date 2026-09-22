import {
  isActiveMemoryItem,
  VOCABULARY_MASTERY_THRESHOLD,
} from '../../architecture/vocabularyMemory'
import { getLanguage } from '../../config/languages'
import { PLACEHOLDER_VOCABULARY } from '../../data/placeholders'

export function AdminVocabularyPage() {
  return (
    <div className="admin-page">
      <h1>Vocabulary</h1>
      <p className="admin-page__lede">
        Words stay in memory until KEA has heard them used naturally{' '}
        {VOCABULARY_MASTERY_THRESHOLD} times.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>English</th>
              <th>Translation</th>
              <th>Language</th>
              <th>Successful uses</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_VOCABULARY.map((item) => (
              <tr key={item.id}>
                <td>{item.english}</td>
                <td>{item.translation}</td>
                <td>{getLanguage(item.languageCode).name}</td>
                <td>
                  {item.successfulUses} / {VOCABULARY_MASTERY_THRESHOLD}
                </td>
                <td>
                  {isActiveMemoryItem(item) ? 'Active' : 'Left memory'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
