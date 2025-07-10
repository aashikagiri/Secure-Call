from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash, check_password_hash
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.backends import default_backend
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import json
import uuid
from datetime import datetime
import base64
import time
import sys
import subprocess
import socket

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Database configuration
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://user:password@localhost:5432/videocall_db')

# Update the get_db_connection function with retry logic
def wait_for_database():
    """Wait for database to be available before connecting"""
    max_retries = 30
    retry_delay = 2
    
    print("Waiting for database to be available...")
    
    for attempt in range(max_retries):
        try:
            # Parse DATABASE_URL to get host and port
            import urllib.parse
            parsed = urllib.parse.urlparse(DATABASE_URL)
            host = parsed.hostname
            port = parsed.port or 5432
            
            # Try to connect to the database host/port
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((host, port))
            sock.close()
            
            if result == 0:
                print("Database is available!")
                return True
                
        except Exception as e:
            pass
            
        if attempt < max_retries - 1:
            print(f"Database not ready (attempt {attempt + 1}/{max_retries}). Waiting {retry_delay} seconds...")
            time.sleep(retry_delay)
        else:
            print(f"Database not available after {max_retries} attempts")
            return False
    
    return False

def get_db_connection():
    max_retries = 5
    retry_delay = 1
    
    for attempt in range(max_retries):
        try:
            conn = psycopg2.connect(DATABASE_URL)
            return conn
        except psycopg2.OperationalError as e:
            if attempt < max_retries - 1:
                print(f"Database connection attempt {attempt + 1} failed. Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                print(f"Failed to connect to database after {max_retries} attempts: {e}")
                raise e

# Update the init_db function with better error handling
def init_db():
    """Initialize database tables with retry logic"""
    print("Initializing database...")
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        print("Creating users table...")
        cur.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(80) UNIQUE NOT NULL,
                email VARCHAR(120) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                public_key TEXT,
                private_key TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        print("Creating call_sessions table...")
        cur.execute('''
            CREATE TABLE IF NOT EXISTS call_sessions (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) UNIQUE NOT NULL,
                caller_id INTEGER REFERENCES users(id),
                callee_id INTEGER REFERENCES users(id),
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP
            )
        ''')
        
        print("Creating indexes...")
        cur.execute('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_call_sessions_session_id ON call_sessions(session_id)')
        
        conn.commit()
        cur.close()
        conn.close()
        print("Database initialization completed successfully!")
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        raise e

def generate_rsa_keys():
    """Generate RSA key pair for user"""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    public_key = private_key.public_key()
    
    # Serialize keys
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
    
    return private_pem, public_pem

@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute('SELECT * FROM users WHERE username = %s', (username,))
        user = cur.fetchone()
        cur.close()
        conn.close()
        
        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            return jsonify({'success': True, 'redirect': url_for('index')})
        else:
            return jsonify({'success': False, 'message': 'Invalid credentials'})
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        # Generate RSA keys for the user
        private_key, public_key = generate_rsa_keys()
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        try:
            cur.execute('''
                INSERT INTO users (username, email, password_hash, public_key, private_key)
                VALUES (%s, %s, %s, %s, %s)
            ''', (username, email, generate_password_hash(password), public_key, private_key))
            conn.commit()
            
            return jsonify({'success': True, 'message': 'Registration successful'})
        except psycopg2.IntegrityError:
            return jsonify({'success': False, 'message': 'Username or email already exists'})
        finally:
            cur.close()
            conn.close()
    
    return render_template('register.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/api/users')
def get_users():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT id, username FROM users WHERE id != %s', (session['user_id'],))
    users = cur.fetchall()
    cur.close()
    conn.close()
    
    return jsonify([dict(user) for user in users])

@app.route('/api/call/<int:user_id>')
def initiate_call(user_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    session_id = str(uuid.uuid4())
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO call_sessions (session_id, caller_id, callee_id)
        VALUES (%s, %s, %s)
    ''', (session_id, session['user_id'], user_id))
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'session_id': session_id})

@app.route('/api/call-status/<session_id>')
def get_call_status(session_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('''
        SELECT cs.*, 
               caller.username as caller_name, 
               callee.username as callee_name
        FROM call_sessions cs
        JOIN users caller ON cs.caller_id = caller.id
        JOIN users callee ON cs.callee_id = callee.id
        WHERE cs.session_id = %s
    ''', (session_id,))
    call = cur.fetchone()
    cur.close()
    conn.close()
    
    if call:
        return jsonify(dict(call))
    else:
        return jsonify({'error': 'Call not found'}), 404

@app.route('/api/answer-call/<session_id>', methods=['POST'])
def answer_call(session_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        UPDATE call_sessions 
        SET status = 'active' 
        WHERE session_id = %s AND callee_id = %s
    ''', (session_id, session['user_id']))
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/api/reject-call/<session_id>', methods=['POST'])
def reject_call(session_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        UPDATE call_sessions 
        SET status = 'rejected', ended_at = CURRENT_TIMESTAMP 
        WHERE session_id = %s AND callee_id = %s
    ''', (session_id, session['user_id']))
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'success': True})

# WebSocket events for real-time communication
@socketio.on('join_call')
def on_join_call(data):
    session_id = data['session_id']
    join_room(session_id)
    emit('user_joined', {'user': session.get('username')}, room=session_id)

@socketio.on('leave_call')
def on_leave_call(data):
    session_id = data['session_id']
    leave_room(session_id)
    emit('user_left', {'user': session.get('username')}, room=session_id)

@socketio.on('offer')
def on_offer(data):
    emit('offer', data, room=data['session_id'], include_self=False)

@socketio.on('answer')
def on_answer(data):
    emit('answer', data, room=data['session_id'], include_self=False)

@socketio.on('ice_candidate')
def on_ice_candidate(data):
    emit('ice_candidate', data, room=data['session_id'], include_self=False)

@socketio.on('incoming_call')
def on_incoming_call(data):
    session_id = data['session_id']
    callee_id = data['callee_id']
    caller_name = data['caller_name']
    
    print(f"Incoming call from {caller_name} to user {callee_id}")
    
    # Emit to the specific user being called
    emit('incoming_call_notification', {
        'session_id': session_id,
        'caller_name': caller_name,
        'caller_id': session.get('user_id')
    }, room=f"user_{callee_id}")
    
    print(f"Emitted incoming_call_notification to room user_{callee_id}")

@socketio.on('call_answered')
def on_call_answered(data):
    session_id = data['session_id']
    emit('call_answered', data, room=session_id, include_self=False)

@socketio.on('call_rejected')
def on_call_rejected(data):
    session_id = data['session_id']
    emit('call_rejected', data, room=session_id, include_self=False)

@socketio.on('join_user_room')
def on_join_user_room():
    if 'user_id' in session:
        join_room(f"user_{session['user_id']}")

@socketio.on('call_ended')
def on_call_ended(data):
    session_id = data['session_id']
    # Update call status in database
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        UPDATE call_sessions 
        SET status = 'ended', ended_at = CURRENT_TIMESTAMP 
        WHERE session_id = %s
    ''', (session_id,))
    conn.commit()
    cur.close()
    conn.close()
    
    # Notify all participants that call has ended
    emit('call_terminated', {
        'session_id': session_id,
        'reason': 'ended',
        'message': 'Call ended'
    }, room=session_id)

@socketio.on('call_declined')
def on_call_declined(data):
    session_id = data['session_id']
    # Update call status in database
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        UPDATE call_sessions 
        SET status = 'declined', ended_at = CURRENT_TIMESTAMP 
        WHERE session_id = %s
    ''', (session_id,))
    conn.commit()
    cur.close()
    conn.close()
    
    # Notify caller that call was declined
    emit('call_terminated', {
        'session_id': session_id,
        'reason': 'declined',
        'message': 'Call was declined'
    }, room=session_id)

@socketio.on('user_busy')
def on_user_busy(data):
    session_id = data['session_id']
    # Notify caller that user is busy
    emit('call_terminated', {
        'session_id': session_id,
        'reason': 'busy',
        'message': 'User is busy'
    }, room=session_id)

if __name__ == '__main__':
    # Wait for database to be available
    if not wait_for_database():
        print("Could not connect to database. Exiting...")
        sys.exit(1)
    
    # Initialize database
    try:
        init_db()
    except Exception as e:
        print(f"Database initialization failed: {e}")
        sys.exit(1)
    
    print("Starting Flask application with HTTPS using mkcert...")

    # Use mkcert-generated certificate for HTTPS
    ssl_cert_path = 'localhost+2.pem'
    ssl_key_path = 'localhost+2-key.pem'

    socketio.run(
        app,
        host='0.0.0.0',
        port=5000,
        debug=True,
        ssl_context=(ssl_cert_path, ssl_key_path),
        allow_unsafe_werkzeug=True  # only for dev/testing
    )

