// Association Management Frontend Utilities

/**
 * React Hook for Association Management
 */
const useAssociations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submitAssociationRequest = async (requestedRole, institute, requestMessage) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/associations/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requestedRole,
          institute,
          requestMessage
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit association request');
      }

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getPendingRequests = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/associations/pending', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch pending requests');
      }

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getMyRequests = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/associations/my-requests', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch your requests');
      }

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const respondToRequest = async (requestId, action, response) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/associations/${requestId}/respond`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, response })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to respond to request');
      }

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const cancelRequest = async (requestId) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/associations/${requestId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to cancel request');
      }

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getAvailableVerifiers = async (institute, search, page = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
      
      if (institute) params.append('institute', institute);
      if (search) params.append('search', search);

      const response = await fetch(`/api/associations/verifiers?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch verifiers');
      }

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    submitAssociationRequest,
    getPendingRequests,
    getMyRequests,
    respondToRequest,
    cancelRequest,
    getAvailableVerifiers
  };
};

/**
 * Association Request Form Component
 */
const AssociationRequestForm = ({ onSuccess }) => {
  const [requestedRole, setRequestedRole] = useState('STUDENT');
  const [institute, setInstitute] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const { submitAssociationRequest, loading, error } = useAssociations();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const result = await submitAssociationRequest(
        requestedRole,
        institute,
        requestMessage
      );
      
      alert('Association request submitted successfully!');
      onSuccess?.(result);
      
      // Reset form
      setInstitute('');
      setRequestMessage('');
    } catch (error) {
      // Error is handled by the hook
    }
  };

  return (
    <div className="association-request-form">
      <h3>Request Institute Association</h3>
      {error && <div className="error">{error}</div>}
      
      <form onSubmit={handleSubmit}>

        <div className="form-group">
          <label htmlFor="requestedRole">Requested Role:</label>
          <select
            id="requestedRole"
            value={requestedRole}
            onChange={(e) => setRequestedRole(e.target.value)}
            required
          >
            <option value="STUDENT">Student</option>
            <option value="VERIFIER">Verifier</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="institute">Institute Name:</label>
          <input
            type="text"
            id="institute"
            value={institute}
            onChange={(e) => setInstitute(e.target.value)}
            placeholder="e.g., Stanford University, MIT, IIT Delhi"
            required
            maxLength={200}
          />
        </div>

        <div className="form-group">
          <label htmlFor="requestMessage">Request Message (Optional):</label>
          <textarea
            id="requestMessage"
            value={requestMessage}
            onChange={(e) => setRequestMessage(e.target.value)}
            placeholder="Add a message to help the verifier identify you (e.g., your student ID, course, etc.)"
            maxLength={500}
            rows={3}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
};

/**
 * Verifier Dashboard - Pending Requests
 */
const VerifierDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [response, setResponse] = useState('');
  const { getPendingRequests, respondToRequest, loading, error } = useAssociations();

  useEffect(() => {
    loadPendingRequests();
  }, []);

  const loadPendingRequests = async () => {
    try {
      const data = await getPendingRequests();
      setRequests(data.requests);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const handleResponse = async (requestId, action) => {
    try {
      await respondToRequest(requestId, action, response);
      alert(`Request ${action}d successfully!`);
      setSelectedRequest(null);
      setResponse('');
      loadPendingRequests(); // Reload requests
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <div className="verifier-dashboard">
      <h2>Pending Association Requests</h2>
      {error && <div className="error">{error}</div>}
      
      {requests.length === 0 ? (
        <p>No pending association requests.</p>
      ) : (
        <div className="requests-list">
          {requests.map(request => (
            <div key={request.id} className="request-card">
              <div className="student-info">
                <h4>{request.student.name}</h4>
                <p>Email: {request.student.email}</p>
                <p>Requested Role: <strong>{request.requestedRole}</strong></p>
                <p>Institute: {request.institute}</p>
                <p>Requested: {new Date(request.requestedAt).toLocaleDateString()}</p>
                {request.requestMessage && (
                  <div className="request-message">
                    <strong>Message:</strong>
                    <p>{request.requestMessage}</p>
                  </div>
                )}
              </div>
              
              <div className="request-actions">
                <button 
                  className="approve-btn"
                  onClick={() => setSelectedRequest(request)}
                  disabled={loading}
                >
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRequest && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Review Association Request</h3>
            <div className="request-details">
              <p><strong>Student:</strong> {selectedRequest.student.name}</p>
              <p><strong>Email:</strong> {selectedRequest.student.email}</p>
              <p><strong>Requested Role:</strong> {selectedRequest.requestedRole}</p>
              <p><strong>Institute:</strong> {selectedRequest.institute}</p>
              {selectedRequest.requestMessage && (
                <div>
                  <strong>Student's Message:</strong>
                  <p>{selectedRequest.requestMessage}</p>
                </div>
              )}
            </div>

            <div className="response-section">
              <label htmlFor="response">Response Message (Optional):</label>
              <textarea
                id="response"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Add a message for the student..."
                maxLength={500}
                rows={3}
              />
            </div>

            <div className="modal-actions">
              <button 
                className="approve-btn"
                onClick={() => handleResponse(selectedRequest.id, 'approve')}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Approve'}
              </button>
              <button 
                className="reject-btn"
                onClick={() => handleResponse(selectedRequest.id, 'reject')}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Reject'}
              </button>
              <button 
                className="cancel-btn"
                onClick={() => {
                  setSelectedRequest(null);
                  setResponse('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Student Dashboard - My Requests
 */
const StudentDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [associationStatus, setAssociationStatus] = useState(null);
  const { getMyRequests, cancelRequest, loading, error } = useAssociations();

  useEffect(() => {
    loadMyRequests();
  }, []);

  const loadMyRequests = async () => {
    try {
      const data = await getMyRequests();
      setRequests(data.requests);
      setAssociationStatus(data);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (confirm('Are you sure you want to cancel this request?')) {
      try {
        await cancelRequest(requestId);
        alert('Request cancelled successfully!');
        loadMyRequests();
      } catch (error) {
        // Error handled by hook
      }
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      PENDING: { text: 'Pending', class: 'status-pending' },
      APPROVED: { text: 'Approved', class: 'status-approved' },
      REJECTED: { text: 'Rejected', class: 'status-rejected' }
    };
    return badges[status] || { text: status, class: 'status-unknown' };
  };

  return (
    <div className="student-dashboard">
      <h2>My Association Status</h2>
      
      {associationStatus && (
        <div className="association-status">
          <p><strong>Current Role:</strong> {associationStatus.currentRole}</p>
          <p><strong>Institute:</strong> {associationStatus.currentInstitute || 'Not set'}</p>
          <p><strong>Role Permanent:</strong> {associationStatus.roleSetPermanently ? 'Yes' : 'No'}</p>
          <p><strong>Association Status:</strong> {associationStatus.associationStatus}</p>
          
          {associationStatus.roleSetPermanently && (
            <div className="permanent-role-notice">
              <p>✅ Your role has been set permanently and cannot be changed.</p>
              {associationStatus.approvedAt && (
                <p>Approved on: {new Date(associationStatus.approvedAt).toLocaleDateString()}</p>
              )}
            </div>
          )}
        </div>
      )}

      <h3>My Association Requests</h3>
      {error && <div className="error">{error}</div>}
      
      {requests.length === 0 ? (
        <p>No association requests found.</p>
      ) : (
        <div className="requests-list">
          {requests.map(request => {
            const badge = getStatusBadge(request.status);
            return (
              <div key={request.id} className="request-card">
                <div className="request-header">
                  <h4>{request.verifier.name}</h4>
                  <span className={`status-badge ${badge.class}`}>
                    {badge.text}
                  </span>
                </div>
                
                <div className="request-details">
                  <p><strong>Verifier:</strong> {request.verifier.email}</p>
                  <p><strong>Institute:</strong> {request.institute}</p>
                  <p><strong>Requested Role:</strong> {request.requestedRole}</p>
                  <p><strong>Requested:</strong> {new Date(request.requestedAt).toLocaleDateString()}</p>
                  
                  {request.requestMessage && (
                    <div className="request-message">
                      <strong>Your Message:</strong>
                      <p>{request.requestMessage}</p>
                    </div>
                  )}
                  
                  {request.verifierResponse && (
                    <div className="verifier-response">
                      <strong>Verifier Response:</strong>
                      <p>{request.verifierResponse}</p>
                    </div>
                  )}
                  
                  {request.respondedAt && (
                    <p><strong>Responded:</strong> {new Date(request.respondedAt).toLocaleDateString()}</p>
                  )}
                </div>
                
                {request.status === 'PENDING' && !request.isExpired && (
                  <div className="request-actions">
                    <button 
                      className="cancel-btn"
                      onClick={() => handleCancelRequest(request.id)}
                      disabled={loading}
                    >
                      Cancel Request
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Vanilla JS API for non-React applications
const AssociationAPI = {
  async submitRequest(requestedRole, institute, requestMessage) {
    const token = localStorage.getItem('authToken');
    const response = await fetch('/api/associations/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        requestedRole,
        institute,
        requestMessage
      })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    return data;
  },

  async getPendingRequests() {
    const token = localStorage.getItem('authToken');
    const response = await fetch('/api/associations/pending', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    return data;
  },

  async respondToRequest(requestId, action, responseMessage) {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`/api/associations/${requestId}/respond`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action, response: responseMessage })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    return data;
  }
};

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    useAssociations, 
    AssociationRequestForm, 
    VerifierDashboard, 
    StudentDashboard,
    AssociationAPI 
  };
}

if (typeof window !== 'undefined') {
  window.AssociationAPI = AssociationAPI;
  window.useAssociations = useAssociations;
}