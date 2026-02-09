import { useState, useEffect, useRef } from 'react';
import { clientApi, KnowledgeDocument } from '../../services/api';

function KnowledgeBase() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'documents' | 'add'>('documents');

  // Add document form
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addMode, setAddMode] = useState<'text' | 'file'>('text');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  // Poll for processing status
  useEffect(() => {
    const processing = documents.filter(d => d.embedding_status === 'pending' || d.embedding_status === 'processing');
    if (processing.length === 0) return;

    const interval = setInterval(async () => {
      let updated = false;
      for (const doc of processing) {
        try {
          const res = await clientApi.getKnowledgeDocumentStatus(doc.id);
          if (res.data.embedding_status !== doc.embedding_status) {
            updated = true;
          }
        } catch { /* ignore */ }
      }
      if (updated) loadDocuments();
    }, 5000);

    return () => clearInterval(interval);
  }, [documents]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const res = await clientApi.getKnowledgeDocuments();
      setDocuments(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      setSubmitting(true);
      await clientApi.createKnowledgeDocument({ title: title.trim(), content: content.trim() });
      setTitle('');
      setContent('');
      setActiveTab('documents');
      loadDocuments();
    } catch (err: any) {
      setError(err.message || 'Error al crear documento');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    try {
      setSubmitting(true);
      await clientApi.uploadKnowledgeFile(file, title.trim() || undefined);
      setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setActiveTab('documents');
      loadDocuments();
    } catch (err: any) {
      setError(err.message || 'Error al subir archivo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este documento y todos sus fragmentos?')) return;
    try {
      await clientApi.deleteKnowledgeDocument(id);
      loadDocuments();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar documento');
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      completed: { label: 'Listo', color: '#059669', bg: '#d1fae5' },
      processing: { label: 'Procesando', color: '#d97706', bg: '#fef3c7' },
      pending: { label: 'Pendiente', color: '#6b7280', bg: '#f3f4f6' },
      failed: { label: 'Error', color: '#dc2626', bg: '#fee2e2' },
    };
    const s = map[status] || map.pending;
    return (
      <span style={{
        padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
        color: s.color, backgroundColor: s.bg,
      }}>
        {s.label}
      </span>
    );
  };

  if (loading && documents.length === 0) {
    return (
      <div className="page-content">
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Knowledge Base</h1>
        <p style={{ color: '#6b7280', marginTop: '0.25rem' }}>
          Agrega documentos para que tu asistente IA pueda responder preguntas sobre tu marca, politicas, envios, etc.
        </p>
      </div>

      {error && (
        <div className="card" style={{ padding: '0.75rem 1rem', backgroundColor: '#fee2e2', color: '#dc2626', marginBottom: '1rem' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '1rem', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          className={`btn ${activeTab === 'documents' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('documents')}
        >
          Documentos ({documents.length})
        </button>
        <button
          className={`btn ${activeTab === 'add' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('add')}
        >
          + Agregar
        </button>
      </div>

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="card">
          {documents.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No hay documentos todavia</p>
              <p>Agrega tu primer documento para potenciar las respuestas de tu asistente.</p>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setActiveTab('add')}>
                + Agregar documento
              </button>
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Titulo</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Tipo</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem' }}>Fragmentos</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem' }}>Estado</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Fecha</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id}>
                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>{doc.title}</td>
                    <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                      {doc.source_type === 'text' ? 'Texto' : doc.source_type === 'file' ? 'Archivo' : 'URL'}
                      {doc.original_filename && <span style={{ fontSize: '0.8rem', display: 'block' }}>{doc.original_filename}</span>}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{doc.chunk_count}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      {statusBadge(doc.embedding_status)}
                      {doc.error_message && (
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#dc2626', marginTop: '2px' }}>{doc.error_message}</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.85rem' }}>
                      {new Date(doc.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: '#dc2626' }}
                        onClick={() => handleDelete(doc.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Tab */}
      {activeTab === 'add' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button
              className={`btn ${addMode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setAddMode('text')}
              style={{ flex: 1 }}
            >
              Texto directo
            </button>
            <button
              className={`btn ${addMode === 'file' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setAddMode('file')}
              style={{ flex: 1 }}
            >
              Subir archivo
            </button>
          </div>

          {addMode === 'text' ? (
            <form onSubmit={handleSubmitText}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Titulo</label>
                <input
                  className="form-input"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ej: Politica de devoluciones"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Contenido</label>
                <textarea
                  className="form-input"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Pega aqui el texto del documento..."
                  rows={12}
                  required
                  style={{ resize: 'vertical', minHeight: '200px' }}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar documento'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleUploadFile}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Titulo (opcional)</label>
                <input
                  className="form-input"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Se usara el nombre del archivo si se deja vacio"
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Archivo (.txt, .md, .pdf)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.pdf"
                  required
                  style={{ display: 'block', marginTop: '0.25rem' }}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Subiendo...' : 'Subir archivo'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default KnowledgeBase;
