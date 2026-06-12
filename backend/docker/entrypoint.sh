#!/bin/bash
set -e

# Generate SSH host keys if they don't exist
ssh-keygen -A

# Start Nginx
if [ -f /etc/init.d/nginx ]; then
    service nginx start || true
fi

# PostgreSQL initialization & start
if [ "$ENABLE_POSTGRES" = "true" ]; then
    echo "[ENTRYPOINT] Enabling PostgreSQL..."
    mkdir -p /app/postgres/data
    chown -R postgres:postgres /app/postgres
    
    # Init DB if not initialized
    if [ ! -s /app/postgres/data/PG_VERSION ]; then
        echo "[ENTRYPOINT] Initializing PostgreSQL database..."
        su - postgres -c "/usr/lib/postgresql/*/bin/initdb -D /app/postgres/data"
        echo "host all all 0.0.0.0/0 md5" >> /app/postgres/data/pg_hba.conf
        echo "listen_addresses = '*'" >> /app/postgres/data/postgresql.conf
    fi
    
    # Start Postgres
    echo "[ENTRYPOINT] Starting PostgreSQL..."
    su - postgres -c "/usr/lib/postgresql/*/bin/pg_ctl -D /app/postgres/data -l /app/postgres/logfile start"
    
    # Set password
    if [ -n "$DB_PASSWORD" ]; then
        echo "[ENTRYPOINT] Setting PostgreSQL password..."
        sleep 2
        su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';\"" || true
    fi
fi

# MySQL initialization & start
if [ "$ENABLE_MYSQL" = "true" ]; then
    echo "[ENTRYPOINT] Enabling MySQL..."
    mkdir -p /app/mysql/data
    chown -R mysql:mysql /app/mysql
    
    # Init DB if not initialized
    if [ ! -d "/app/mysql/data/mysql" ]; then
        echo "[ENTRYPOINT] Initializing MySQL database..."
        mysqld --initialize-insecure --user=mysql --datadir=/app/mysql/data
    fi
    
    # Start MySQL in background
    echo "[ENTRYPOINT] Starting MySQL..."
    mysqld_safe --user=mysql --datadir=/app/mysql/data --bind-address=0.0.0.0 &
    
    # Set password
    if [ -n "$DB_PASSWORD" ]; then
        echo "[ENTRYPOINT] Setting MySQL password..."
        sleep 5
        mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$DB_PASSWORD'; CREATE USER 'root'@'%' IDENTIFIED BY '$DB_PASSWORD'; GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION; FLUSH PRIVILEGES;" || true
    fi
fi

# PM2 resurrect
if command -v pm2 >/dev/null 2>&1; then
    echo "[ENTRYPOINT] Resurrecting PM2 processes..."
    pm2 resurrect || true
fi

# Start SSH daemon in foreground
echo "[ENTRYPOINT] Starting SSH Daemon..."
exec /usr/sbin/sshd -D
