// Frontend utility for Google Auth popup
// Place this in your frontend project (React/Vue/etc.)

/**
 * Opens Google Auth popup and returns a promise with user data
 * @param {string} backendUrl - Your backend URL (e.g., 'http://localhost:3000')
 * @returns {Promise<Object>} User data from successful authentication
 */
export const openGoogleAuthPopup = (backendUrl = 'http://localhost:3000') => {
  return new Promise((resolve, reject) => {
    // Open popup window
    const popup = window.open(
      `${backendUrl}/api/auth/google`,
      'google-auth',
      'width=500,height=600,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,directories=no,status=no'
    );

    // Listen for messages from popup
    const handleMessage = (event) => {
      // Security: Verify origin
      if (event.origin !== backendUrl) return;
      
      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        window.removeEventListener('message', handleMessage);
        resolve({
          token: event.data.token,
          user: event.data.user
        });
      } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
        window.removeEventListener('message', handleMessage);
        reject(new Error(event.data.error || 'Authentication failed'));
      }
    };

    window.addEventListener('message', handleMessage);

    // Check if popup was closed manually
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        reject(new Error('Authentication cancelled'));
      }
    }, 1000);
  });
};

/**
 * React hook example for using Google Auth
 */
export const useGoogleAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loginWithGoogle = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { token, user } = await openGoogleAuthPopup();
      
      // Store token in localStorage or your preferred storage
      localStorage.setItem('authToken', token);
      
      // You can dispatch to Redux, update context, etc.
      console.log('User authenticated:', user);
      
      return { token, user };
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { loginWithGoogle, loading, error };
};

/**
 * React component example
 */
export const GoogleLoginButton = ({ onSuccess, onError }) => {
  const { loginWithGoogle, loading, error } = useGoogleAuth();

  const handleLogin = async () => {
    try {
      const result = await loginWithGoogle();
      onSuccess?.(result);
    } catch (err) {
      onError?.(err);
    }
  };

  return (
    <button 
      onClick={handleLogin}
      disabled={loading}
      className="google-login-btn"
    >
      {loading ? 'Signing in...' : 'Sign in with Google'}
    </button>
  );
};

/**
 * Vanilla JavaScript example
 */
export const handleGoogleLogin = async () => {
  try {
    const { token, user } = await openGoogleAuthPopup('http://localhost:3000');
    
    // Store token
    localStorage.setItem('authToken', token);
    
    // Redirect or update UI
    console.log('Login successful:', user);
    window.location.href = '/dashboard';
    
  } catch (error) {
    console.error('Login failed:', error);
    alert('Login failed: ' + error.message);
  }
};