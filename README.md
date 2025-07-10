# SecureCall - Professional Video Calling Application

A secure, professional video calling web application built with Flask, PostgreSQL, and WebRTC technology. Features end-to-end encryption, user authentication, and real-time video communication.

## Features

- **Secure Authentication**: User registration and login with password hashing
- **RSA Encryption**: Asymmetric encryption for secure key exchange
- **Real-time Video Calls**: WebRTC-based 1-on-1 video calling
- **Professional UI**: Clean, responsive design suitable for business use
- **PostgreSQL Database**: Robust data storage with Docker support
- **WebSocket Communication**: Real-time signaling for call management
- **Media Controls**: Toggle video/audio during calls

## Technology Stack

- **Backend**: Python Flask, Flask-SocketIO
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Database**: PostgreSQL
- **Real-time**: WebSocket (Socket.IO)
- **Security**: RSA encryption, password hashing
- **Deployment**: Docker & Docker Compose

## Quick Start with Docker

1. **Clone and navigate to the project directory**

2. **Start the application**:
   \`\`\`bash
   docker-compose up --build
   \`\`\`

3. **Access the application**:
   - Open your browser to \`http://localhost:5000\`
   - Register a new account or login
   - Start making secure video calls!

## Manual Setup (Development)

### Prerequisites
- Python 3.9+
- PostgreSQL 12+
- Node.js (for frontend dependencies)

### Installation

1. **Install Python dependencies**:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`

2. **Setup PostgreSQL database**:
   \`\`\`bash
   createdb videocall_db
   \`\`\`

3. **Set environment variables**:
   \`\`\`bash
   export DATABASE_URL="postgresql://username:password@localhost:5432/videocall_db"
   export SECRET_KEY="your-secret-key-here"
   \`\`\`

4. **Run the application**:
   \`\`\`bash
   python app.py
   \`\`\`

## Project Structure

\`\`\`
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose setup
├── templates/            # HTML templates
│   ├── base.html         # Base template
│   ├── index.html        # Dashboard
│   ├── login.html        # Login page
│   └── register.html     # Registration page
├── static/               # Static assets
│   ├── css/
│   │   └── style.css     # Main stylesheet
│   └── js/
│       ├── main.js       # Core JavaScript
│       ├── auth.js       # Authentication logic
│       └── videocall.js  # WebRTC implementation
└── scripts/
    └── init_db.sql       # Database initialization
\`\`\`

## Security Features

- **Password Hashing**: Werkzeug security for password protection
- **RSA Key Pairs**: Generated for each user during registration
- **Session Management**: Secure Flask sessions
- **CORS Protection**: Configured for production use
- **Input Validation**: Server-side validation for all inputs

## API Endpoints

- \`GET /\` - Dashboard (requires authentication)
- \`GET/POST /login\` - User authentication
- \`GET/POST /register\` - User registration
- \`GET /api/users\` - Get available users for calling
- \`POST /api/call/<user_id>\` - Initiate a video call

## WebSocket Events

- \`join_call\` - Join a call session
- \`leave_call\` - Leave a call session
- \`offer\` - WebRTC offer exchange
- \`answer\` - WebRTC answer exchange
- \`ice_candidate\` - ICE candidate exchange

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Production Deployment

1. **Update environment variables**:
   - Set a strong \`SECRET_KEY\`
   - Configure production database URL
   - Enable HTTPS for secure WebRTC

2. **Database migrations**:
   - The app automatically creates tables on startup
   - For production, consider using proper migration tools

3. **HTTPS Configuration**:
   - WebRTC requires HTTPS in production
   - Configure SSL certificates
   - Update CORS settings

## Troubleshooting

### Common Issues

1. **Camera/Microphone Access**: Ensure HTTPS is enabled for WebRTC
2. **Database Connection**: Check PostgreSQL is running and accessible
3. **Port Conflicts**: Ensure ports 5000 and 5432 are available

### Development Tips

- Use browser developer tools to debug WebRTC connections
- Check Flask logs for backend issues
- Monitor PostgreSQL logs for database problems

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section
- Review browser console for errors
- Ensure all dependencies are properly installed
\`\`\`
