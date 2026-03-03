"""
Database Module - MySQL for threat logging
"""

import mysql.connector
from mysql.connector import Error
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MySQL Configuration from .env
MYSQL_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'localhost'),
    'port': int(os.getenv('MYSQL_PORT', 3306)),
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', ''),
    'database': os.getenv('MYSQL_DATABASE', 'nullpoint'),
    'autocommit': True
}

THREATS_TABLE = os.getenv('MYSQL_TABLE', 'threats')


def get_connection():
    """Get MySQL database connection"""
    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        return conn
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None


def init_db():
    """Initialize the database with required tables"""
    conn = get_connection()
    if not conn:
        print("Failed to connect to MySQL. Please check your .env configuration.")
        return
    
    cursor = conn.cursor()
    
    try:
        # Create threats table
        cursor.execute(f'''
            CREATE TABLE IF NOT EXISTS {THREATS_TABLE} (
                id INT AUTO_INCREMENT PRIMARY KEY,
                timestamp DATETIME NOT NULL,
                threat_type VARCHAR(100) NOT NULL,
                category VARCHAR(50) NOT NULL,
                severity VARCHAR(20) NOT NULL,
                source VARCHAR(50) NOT NULL,
                details TEXT,
                raw_data TEXT,
                session_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_timestamp (timestamp),
                INDEX idx_type (threat_type),
                INDEX idx_category (category),
                INDEX idx_severity (severity)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ''')
        
        conn.commit()
        print(f"Database initialized. Table '{THREATS_TABLE}' ready.")
    except Error as e:
        print(f"Error initializing database: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def log_threat(
    threat_type: str,
    category: str,
    severity: str,
    source: str,
    details: Optional[str] = None,
    raw_data: Optional[Dict[str, Any]] = None,
    session_id: Optional[str] = None
):
    """
    Log a threat to the MySQL database
    
    Args:
        threat_type: Type of threat (e.g., 'PII_LEAK', 'HALLUCINATION', 'INJECTION_ATTACK')
        category: Category of threat (e.g., 'PII', 'CODE', 'SECURITY')
        severity: Severity level (e.g., 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
        source: Source of threat (e.g., 'INPUT', 'OUTPUT', 'CODE_SCAN')
        details: Human-readable details about the threat
        raw_data: Raw data associated with the threat (stored as JSON)
        session_id: Optional session identifier
    """
    conn = get_connection()
    if not conn:
        print("Failed to connect to MySQL. Threat not logged.")
        return
    
    cursor = conn.cursor()
    
    try:
        timestamp = datetime.utcnow()
        raw_data_json = json.dumps(raw_data) if raw_data else None
        
        cursor.execute(f'''
            INSERT INTO {THREATS_TABLE} 
            (timestamp, threat_type, category, severity, source, details, raw_data, session_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            timestamp,
            threat_type,
            category,
            severity,
            source,
            details,
            raw_data_json,
            session_id
        ))
        
        conn.commit()
    except Error as e:
        print(f"Error logging threat: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def get_recent_threats(limit: int = 100, category: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Get recent threats from the database
    
    Args:
        limit: Maximum number of threats to return
        category: Optional category filter
    """
    conn = get_connection()
    if not conn:
        return []
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        if category:
            cursor.execute(f'''
                SELECT * FROM {THREATS_TABLE}
                WHERE category = %s
                ORDER BY timestamp DESC
                LIMIT %s
            ''', (category, limit))
        else:
            cursor.execute(f'''
                SELECT * FROM {THREATS_TABLE}
                ORDER BY timestamp DESC
                LIMIT %s
            ''', (limit,))
        
        threats = cursor.fetchall()
        
        # Convert datetime objects to strings for JSON serialization
        for threat in threats:
            if threat.get('timestamp'):
                threat['timestamp'] = threat['timestamp'].isoformat() if hasattr(threat['timestamp'], 'isoformat') else str(threat['timestamp'])
            if threat.get('created_at'):
                threat['created_at'] = threat['created_at'].isoformat() if hasattr(threat['created_at'], 'isoformat') else str(threat['created_at'])
            if threat.get('raw_data'):
                try:
                    threat['raw_data'] = json.loads(threat['raw_data'])
                except:
                    pass
        
        return threats
    except Error as e:
        print(f"Error fetching threats: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_threat_stats() -> Dict[str, Any]:
    """Get statistics about threats by category and severity"""
    conn = get_connection()
    if not conn:
        return {}
    
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Count by category
        cursor.execute(f'''
            SELECT category, COUNT(*) as count
            FROM {THREATS_TABLE}
            GROUP BY category
        ''')
        by_category = {row['category']: row['count'] for row in cursor.fetchall()}
        
        # Count by severity
        cursor.execute(f'''
            SELECT severity, COUNT(*) as count
            FROM {THREATS_TABLE}
            GROUP BY severity
        ''')
        by_severity = {row['severity']: row['count'] for row in cursor.fetchall()}
        
        # Count by threat type
        cursor.execute(f'''
            SELECT threat_type, COUNT(*) as count
            FROM {THREATS_TABLE}
            GROUP BY threat_type
        ''')
        by_type = {row['threat_type']: row['count'] for row in cursor.fetchall()}
        
        # Total count
        cursor.execute(f'SELECT COUNT(*) as total FROM {THREATS_TABLE}')
        total = cursor.fetchone()['total']
        
        return {
            'total': total,
            'by_category': by_category,
            'by_severity': by_severity,
            'by_type': by_type
        }
    except Error as e:
        print(f"Error fetching threat stats: {e}")
        return {}
    finally:
        cursor.close()
        conn.close()
