// Frontend Profile Setup Component Examples

/**
 * React Profile Setup Component
 */
const ProfileSetup = () => {
  const [role, setRole] = useState('');
  const [institute, setInstitute] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkProfileStatus();
  }, []);

  const checkProfileStatus = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/users/profile-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.isSetupComplete) {
        // Redirect to dashboard or show complete profile
        window.location.href = '/dashboard';
      } else {
        // Show setup form
        setRole(data.currentRole || 'STUDENT');
        setInstitute(data.currentInstitute || '');
      }
    } catch (error) {
      console.error('Error checking profile status:', error);
    }
  };

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/users/setup-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role, institute })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Profile setup completed successfully!');
        setUser(data.user);
        // Redirect to dashboard
        window.location.href = '/dashboard';
      } else {
        alert(data.message || 'Failed to setup profile');
      }
    } catch (error) {
      console.error('Profile setup error:', error);
      alert('Failed to setup profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-setup">
      <h2>Complete Your Profile Setup</h2>
      <p>Help us understand your role so we can provide the best experience</p>
      
      <form onSubmit={handleSetupSubmit}>
        <div className="form-group">
          <label htmlFor="role">Select Your Role:</label>
          <select 
            id="role" 
            value={role} 
            onChange={(e) => setRole(e.target.value)}
            required
          >
            <option value="">Choose your role</option>
            <option value="STUDENT">Student</option>
            <option value="VERIFIER">Verifier/Faculty</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="institute">Institute/University Name:</label>
          <input
            type="text"
            id="institute"
            value={institute}
            onChange={(e) => setInstitute(e.target.value)}
            placeholder="Enter your institute name"
            required
            maxLength={200}
          />
        </div>

        {role === 'VERIFIER' && (
          <div className="info-box">
            <p><strong>As a Verifier:</strong></p>
            <ul>
              <li>Help validate student achievements and certificates</li>
              <li>Review and approve verification requests</li>
              <li>Build trust in the academic community</li>
            </ul>
          </div>
        )}

        <button type="submit" disabled={loading || !role || !institute}>
          {loading ? 'Setting up...' : 'Complete Setup'}
        </button>
      </form>
    </div>
  );
};

/**
 * Profile Management Component
 */
const ProfileManagement = ({ user, onUpdate }) => {
  const [role, setRole] = useState(user.role);
  const [institute, setInstitute] = useState(user.institute || '');
  const [loading, setLoading] = useState(false);

  const handleRoleChange = async () => {
    if (!role || (!institute && role === 'VERIFIER')) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/users/change-role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role, institute })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Role updated successfully!');
        onUpdate(data.user);
      } else {
        alert(data.message || 'Failed to update role');
      }
    } catch (error) {
      console.error('Role change error:', error);
      alert('Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-management">
      <h3>Institute Association</h3>
      
      <div className="current-info">
        <p><strong>Current Role:</strong> {user.role}</p>
        <p><strong>Current Institute:</strong> {user.institute || 'Not set'}</p>
      </div>

      <div className="form-group">
        <label htmlFor="newRole">Change Role:</label>
        <select 
          id="newRole" 
          value={role} 
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="STUDENT">Student</option>
          <option value="VERIFIER">Verifier/Faculty</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="newInstitute">Institute Name:</label>
        <input
          type="text"
          id="newInstitute"
          value={institute}
          onChange={(e) => setInstitute(e.target.value)}
          placeholder="Enter institute name"
          maxLength={200}
        />
      </div>

      <button 
        onClick={handleRoleChange} 
        disabled={loading || role === user.role && institute === user.institute}
      >
        {loading ? 'Updating...' : 'Update Association'}
      </button>
    </div>
  );
};

/**
 * Simplified Registration Form
 */
const SimpleRegistrationForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Store token and redirect to profile setup
        localStorage.setItem('authToken', data.token);
        alert('Registration successful! Please complete your profile setup.');
        window.location.href = '/setup-profile';
      } else {
        alert(data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="registration-form">
      <h2>Create Your TruePort Account</h2>
      <p>Join the academic verification platform</p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Full Name:</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            maxLength={100}
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address:</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password:</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            minLength={6}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <div className="alternative-signup">
        <p>Or sign up with:</p>
        <button onClick={() => openGoogleAuthPopup()} className="google-btn">
          Continue with Google
        </button>
      </div>
    </div>
  );
};

// Vanilla JavaScript functions for non-React apps
const ProfileSetupJS = {
  async checkStatus() {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/users/profile-status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await response.json();
    } catch (error) {
      console.error('Error checking profile status:', error);
      return null;
    }
  },

  async completeSetup(role, institute) {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/users/setup-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role, institute })
      });
      return await response.json();
    } catch (error) {
      console.error('Profile setup error:', error);
      throw error;
    }
  },

  async changeRole(role, institute) {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/users/change-role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role, institute })
      });
      return await response.json();
    } catch (error) {
      console.error('Role change error:', error);
      throw error;
    }
  }
};

// Usage examples:
/*
// Check if user needs profile setup
const status = await ProfileSetupJS.checkStatus();
if (!status.isSetupComplete) {
  // Show profile setup form
}

// Complete profile setup
const result = await ProfileSetupJS.completeSetup('STUDENT', 'MIT');

// Change role
const updated = await ProfileSetupJS.changeRole('VERIFIER', 'Stanford University');
*/