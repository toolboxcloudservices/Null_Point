"""
Database Migration Script
Creates the threats table in MySQL database
"""

import mysql.connector
from mysql.connector import Error
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
    'autocommit': True
}

DATABASE_NAME = os.getenv('MYSQL_DATABASE', 'nullpoint')
THREATS_TABLE = os.getenv('MYSQL_TABLE', 'threats')


def create_database_if_not_exists():
    """Create the database if it doesn't exist"""
    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DATABASE_NAME}")
        print(f"✓ Database '{DATABASE_NAME}' ready")
        cursor.close()
        conn.close()
    except Error as e:
        print(f"✗ Error creating database: {e}")
        raise


def create_threats_table():
    """Create the threats table"""
    # Add database to config
    config_with_db = {**MYSQL_CONFIG, 'database': DATABASE_NAME}
    
    try:
        conn = mysql.connector.connect(**config_with_db)
        cursor = conn.cursor()
        
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
                INDEX idx_severity (severity),
                INDEX idx_source (source)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')
        
        conn.commit()
        print(f"✓ Table '{THREATS_TABLE}' created/verified successfully")
        
        # Check if table exists and show structure
        cursor.execute(f"SHOW TABLES LIKE '{THREATS_TABLE}'")
        if cursor.fetchone():
            cursor.execute(f"DESCRIBE {THREATS_TABLE}")
            columns = cursor.fetchall()
            print(f"\nTable structure:")
            for col in columns:
                print(f"  - {col[0]}: {col[1]}")
        
        cursor.close()
        conn.close()
        return True
        
    except Error as e:
        print(f"✗ Error creating table: {e}")
        return False


def main():
    """Run migration"""
    print("=" * 50)
    print("NullPoint Database Migration")
    print("=" * 50)
    print(f"\nConnecting to MySQL:")
    print(f"  Host: {MYSQL_CONFIG['host']}")
    print(f"  Port: {MYSQL_CONFIG['port']}")
    print(f"  User: {MYSQL_CONFIG['user']}")
    print(f"  Database: {DATABASE_NAME}")
    print(f"  Table: {THREATS_TABLE}")
    print()
    
    try:
        # Step 1: Create database
        create_database_if_not_exists()
        
        # Step 2: Create threats table
        if create_threats_table():
            print("\n" + "=" * 50)
            print("✓ Migration completed successfully!")
            print("=" * 50)
        else:
            print("\n" + "=" * 50)
            print("✗ Migration failed!")
            print("=" * 50)
            exit(1)
            
    except Error as e:
        print(f"\n✗ Migration error: {e}")
        print("\nPlease check:")
        print("  1. MySQL server is running")
        print("  2. Credentials in .env file are correct")
        print("  3. User has CREATE DATABASE and CREATE TABLE permissions")
        exit(1)


if __name__ == "__main__":
    main()
