const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kiosko_asistencia'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        process.exit(1);
    }
    
    db.query('SELECT * FROM asistencias ORDER BY id DESC LIMIT 10', (err, rows) => {
        if (err) {
            console.error('Error fetching asistencias:', err.message);
        } else {
            console.log('\nLast 10 asistencias:');
            console.table(rows);
        }
        db.end();
    });
});
