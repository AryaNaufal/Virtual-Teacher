-- AI Teacher Office — skema MySQL / MariaDB
-- Dijalankan otomatis oleh `npm run db:setup` (scripts/db-setup.mjs). Aman dijalankan berulang.

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  full_name VARCHAR(190) NOT NULL DEFAULT '',
  password_hash VARCHAR(100) NOT NULL,
  created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS classes (
  id CHAR(36) PRIMARY KEY, owner_id INT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  KEY (owner_id), FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subjects (
  id CHAR(36) PRIMARY KEY, owner_id INT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  KEY (owner_id), FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS students (
  id CHAR(36) PRIMARY KEY, owner_id INT UNSIGNED NOT NULL,
  class_id CHAR(36) NOT NULL, name VARCHAR(190) NOT NULL, nis VARCHAR(60) NOT NULL DEFAULT '',
  KEY (owner_id), FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendance (
  owner_id INT UNSIGNED NOT NULL, student_id CHAR(36) NOT NULL, date DATE NOT NULL,
  status ENUM('H','S','I','A') NOT NULL,
  PRIMARY KEY (student_id, date), KEY (owner_id),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS grades (
  id CHAR(36) PRIMARY KEY, owner_id INT UNSIGNED NOT NULL,
  student_id CHAR(36) NOT NULL, subject_id CHAR(36) NOT NULL,
  type ENUM('tugas','ujian','praktik') NOT NULL, title VARCHAR(190) NOT NULL, score DECIMAL(6,2) NOT NULL,
  KEY (owner_id), FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS final_grades (
  owner_id INT UNSIGNED NOT NULL, student_id CHAR(36) NOT NULL, subject_id CHAR(36) NOT NULL,
  score DECIMAL(6,2) NOT NULL, approved_at BIGINT NOT NULL,
  PRIMARY KEY (student_id, subject_id), KEY (owner_id),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assignments (
  id CHAR(36) PRIMARY KEY, owner_id INT UNSIGNED NOT NULL,
  class_id CHAR(36) NOT NULL, title VARCHAR(190) NOT NULL, answer_key LONGTEXT NOT NULL,  -- JSON array
  KEY (owner_id), FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assignment_submissions (
  owner_id INT UNSIGNED NOT NULL, quiz_id CHAR(36) NOT NULL, student_id CHAR(36) NOT NULL,
  answers LONGTEXT NOT NULL,  -- JSON array
  correct INT NOT NULL, score DECIMAL(6,2) NOT NULL, status ENUM('recommended','approved') NOT NULL, approved_score DECIMAL(6,2) NULL,
  PRIMARY KEY (quiz_id, student_id), KEY (owner_id),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (quiz_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ai_tasks (
  owner_id INT UNSIGNED NOT NULL, code VARCHAR(40) NOT NULL, title VARCHAR(500) NOT NULL, agent_id VARCHAR(40) NOT NULL,
  created_at BIGINT NOT NULL, deadline BIGINT NOT NULL,
  priority ENUM('low','normal','high') NOT NULL,
  status ENUM('pending','in_progress','needs_approval','completed','failed') NOT NULL,
  result LONGTEXT NULL, group_id VARCHAR(40) NULL, attachment_name VARCHAR(255) NULL,
  PRIMARY KEY (owner_id, code),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ai_task_logs (
  id VARCHAR(190) PRIMARY KEY, owner_id INT UNSIGNED NOT NULL, task_code VARCHAR(40) NOT NULL,
  at BIGINT NOT NULL, text LONGTEXT NOT NULL,
  KEY (owner_id, task_code),
  FOREIGN KEY (owner_id, task_code) REFERENCES ai_tasks(owner_id, code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS generated_documents (
  id CHAR(36) PRIMARY KEY, owner_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL, kind VARCHAR(40) NOT NULL, agent_id VARCHAR(40) NOT NULL,
  class_id CHAR(36) NULL, subject VARCHAR(190) NULL, created_at BIGINT NOT NULL, content LONGTEXT NOT NULL, doc_table LONGTEXT NULL,
  KEY (owner_id), FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS essay_checks (
  id CHAR(36) PRIMARY KEY, owner_id INT UNSIGNED NOT NULL,
  class_id CHAR(36) NOT NULL, title VARCHAR(255) NOT NULL, question LONGTEXT NOT NULL, rubric LONGTEXT NOT NULL,
  items LONGTEXT NOT NULL,  -- JSON array
  KEY (owner_id), FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS paper_checks (  -- koreksi paper siswa (Korektor Paper); teks paper TIDAK disimpan, hanya hasil
  id CHAR(36) PRIMARY KEY, owner_id INT UNSIGNED NOT NULL,
  class_id CHAR(36) NOT NULL, title VARCHAR(255) NOT NULL, requirements LONGTEXT NULL, due VARCHAR(10) NULL,
  rubric LONGTEXT NOT NULL,   -- JSON [{id,name,weight,desc}]
  grading LONGTEXT NOT NULL,  -- JSON {A,B,C}
  items LONGTEXT NOT NULL,    -- JSON [{studentId, status, criteria, feedback, score, ...}]
  KEY (owner_id), FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS document_archives (  -- berkas unggahan; isinya di folder data/uploads/<owner_id>/
  id CHAR(36) PRIMARY KEY, owner_id INT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL, size BIGINT NOT NULL, mime VARCHAR(190) NOT NULL, storage_path VARCHAR(400) NOT NULL, created_at BIGINT NOT NULL,
  KEY (owner_id), FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
