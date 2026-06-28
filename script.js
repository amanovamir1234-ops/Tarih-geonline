// --- БАЗА ДАННЫХ ---
let quizTotalCount = 0;   // Сколько всего УНИКАЛЬНЫХ вопросов в запущенном тесте
let quizCorrectCount = 0; // Сколько вопросов уже решено правильноlet db = null;
let currentLevelUnlocked = 1; 
let activeQuizLevel = null;
let quizQueue = []; 
let pendingSkipLevel = null; // Память для окна пропуска

const nodesWrapper = document.getElementById('nodes-wrapper');
const pathSvg = document.getElementById('path-svg');

// 1. Инициализация
async function init() {
    const response = await fetch('data.json');
    db = await response.json();
    
    const savedProgress = localStorage.getItem('geoProgress');
    if (savedProgress) currentLevelUnlocked = parseInt(savedProgress);

    renderMap();
    window.addEventListener('resize', drawSvgPath);
}

// 2. Отрисовка карты
function renderMap() {
    nodesWrapper.innerHTML = '';
    const totalLevels = Object.keys(db).length;

    for (let i = 1; i <= totalLevels; i++) {
        const levelData = db[i];
        const isUnlocked = i <= currentLevelUnlocked;
        
        const row = document.createElement('div');
        row.className = 'level-row';
        row.innerHTML = `
            <button class="node-btn ${isUnlocked ? 'unlocked' : 'locked'}" id="node-${i}" onclick="handleNodeClick(${i})">
                ${isUnlocked ? i : '🔒'}
                <div class="node-title">${levelData.title}</div>
            </button>
        `;
        nodesWrapper.appendChild(row);
    }
    updateGlobalProgress();
    setTimeout(drawSvgPath, 50); 
}

// 3. Динамическая SVG линия пути
function drawSvgPath() {
    const nodes = document.querySelectorAll('.node-btn');
    if (nodes.length < 2) return;

    const containerRect = document.getElementById('path-container').getBoundingClientRect();
    let pathString = '';

    nodes.forEach((node, index) => {
        const rect = node.getBoundingClientRect();
        const x = rect.left + rect.width / 2 - containerRect.left;
        const y = rect.top + rect.height / 2 - containerRect.top;

        if (index === 0) {
            pathString += `M ${x} ${y} `;
        } else {
            const prevRect = nodes[index-1].getBoundingClientRect();
            const prevX = prevRect.left + prevRect.width / 2 - containerRect.left;
            const prevY = prevRect.top + prevRect.height / 2 - containerRect.top;
            const cpY = (y + prevY) / 2;
            pathString += `C ${prevX} ${cpY}, ${x} ${cpY}, ${x} ${y} `;
        }
    });

    pathSvg.innerHTML = `<path d="${pathString}" fill="none" stroke="var(--path-color)" stroke-width="12" stroke-linecap="round"/>`;
}

// 4. Логика клика (Красивое окно пропуска)
function handleNodeClick(levelId) {
    if (levelId > currentLevelUnlocked) {
        // Показываем наше новое красивое HTML окно
        pendingSkipLevel = levelId;
        document.getElementById('fast-track-target').innerText = levelId;
        document.getElementById('fast-track-modal').style.display = 'flex';
        return;
    }
    
    // Если уровень открыт - читаем теорию
    openTheory(levelId);
}

// Кнопка "Вперед!" в нашем новом окне
document.getElementById('confirm-skip-btn').onclick = () => {
    if (pendingSkipLevel) {
        currentLevelUnlocked = pendingSkipLevel;
        localStorage.setItem('geoProgress', currentLevelUnlocked);
        
        closeModal('fast-track-modal');
        renderMap(); 
        
        setTimeout(() => {
            openTheory(pendingSkipLevel);
            pendingSkipLevel = null; 
        }, 300);
    }
};

// 5. Модалки (Теория)
function openTheory(levelId) {
    activeQuizLevel = levelId;
    const data = db[levelId];
    
    document.getElementById('theory-title').innerText = data.title;
    document.getElementById('theory-text').innerHTML = data.theory;
    
    document.getElementById('theory-modal').style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

document.getElementById('go-to-quiz').onclick = () => {
    closeModal('theory-modal');
    startQuiz(activeQuizLevel);
};

// 6. КВИЗ И СИСТЕМА УСВОЕНИЯ
function startQuiz(levelId) {
    const data = db[levelId];
    quizQueue = [...data.questions].map((q, index) => ({...q, originalIndex: index}));
    
    // Фиксируем количество вопросов для обычного уровня
    quizTotalCount = quizQueue.length;
    quizCorrectCount = 0;
    
    document.getElementById('quiz-modal').style.display = 'flex';
    renderNextQuestion();
}

function renderNextQuestion() {
    if (quizQueue.length === 0) {
        completeLevel();
        return;
    }

    // Выводим актуальный счет на плашку
    document.getElementById('correct-score-span').innerText = quizCorrectCount;
    document.getElementById('total-score-span').innerText = quizTotalCount;

    const currentQ = quizQueue[0];
    document.getElementById('question-text').innerText = currentQ.q;
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    currentQ.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = (e) => checkAnswer(idx, currentQ.ans, e.target);
        optionsContainer.appendChild(btn);
    });

    // Твой расчет зеленой полосы прогресса (работает параллельно)
    let totalOriginal = activeQuizLevel === 'mega' ? megaQuizTotal : db[activeQuizLevel].questions.length;
    let percent = ((totalOriginal - quizQueue.length) / totalOriginal) * 100;
    if (percent < 0) percent = 0;
    document.getElementById('quiz-progress').style.width = percent + '%';
}

function checkAnswer(selectedIdx, correctIdx, btnElement) {
    // Сразу блокируем все кнопки, чтобы нельзя было нажать на другую во время паузы
    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach(btn => btn.disabled = true);

    if (selectedIdx === correctIdx) {
        // ПРАВИЛЬНЫЙ ОТВЕТ
        btnElement.style.backgroundColor = 'rgba(46, 204, 113, 0.4)';
        btnElement.style.borderColor = '#2ecc71';
        
        quizCorrectCount++; // Увеличиваем счетчик правильных!
        quizQueue.shift();  // Удаляем вопрос из базы, он пройден
        
        setTimeout(renderNextQuestion, 500);
    } else {
    btnElement.classList.add('shake');

    if (buttons[correctIdx]) {
        buttons[correctIdx].style.backgroundColor = 'rgba(46, 204, 113, 0.4)';
        buttons[correctIdx].style.borderColor = '#2ecc71';
    }

    const wrongQuestion = quizQueue.shift();

    const position = Math.min(
        Math.floor(Math.random() * 2) + 2,
        quizQueue.length
    );

    quizQueue.splice(position, 0, wrongQuestion);

    setTimeout(renderNextQuestion, 900);
}
}

function completeLevel() {
    closeModal('quiz-modal');
    
    // Если это был Мега-Квиз
    if (activeQuizLevel === 'mega') {
        alert("🏆 КРАСАВЧИК! ТЫ УСПЕШНО ПРОШЕЛ МЕГА-КВИЗ ПО ВСЕМ 48 ТЕМАМ!");
        return; // Дальше не идем, чтобы не повышать уровень на карте
    }

    // Если обычный уровень
    if (activeQuizLevel === currentLevelUnlocked) {
        currentLevelUnlocked++;
        localStorage.setItem('geoProgress', currentLevelUnlocked);
    }
    renderMap();
}

function updateGlobalProgress() {
    const total = Object.keys(db).length;
    // Убрали минус один, теперь прогресс считается от текущего открытого уровня
    let percent = Math.round((currentLevelUnlocked / total) * 100);
    
    // Защита, чтобы не ушло больше 100%
    if(percent > 100) percent = 100;
    
    document.getElementById('progress-percent').innerText = percent + '%';
    document.getElementById('main-progress').style.width = percent + '%';
}

// Утилиты
document.getElementById('theme-toggle').onclick = () => {
    document.body.classList.toggle('dark-mode');
};

document.getElementById('unlock-all-btn').onclick = () => {
    currentLevelUnlocked = Object.keys(db).length;
    renderMap();
};

// Открытие стильного окна сброса
document.getElementById('restart-btn').onclick = () => {
    document.getElementById('restart-modal').style.display = 'flex';
};

// Логика кнопки "Да, стереть" внутри окна
document.getElementById('confirm-restart-btn').onclick = () => {
    currentLevelUnlocked = 1; // Сбрасываем уровень
    localStorage.removeItem('geoProgress'); // Удаляем память
    renderMap(); // Перерисовываем карту на 1 уровень
    closeModal('restart-modal'); // Закрываем окно
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Ползем наверх
};

// Логика кнопки "Вся База" (С аккордеоном)
document.getElementById('full-db-btn').onclick = () => {
    const container = document.getElementById('full-database-content');
    container.innerHTML = ''; 
    
    const totalLevels = Object.keys(db).length;
    for (let i = 1; i <= totalLevels; i++) {
        const item = db[i];
        
        let qaHTML = '<div class="qa-list">';
        item.questions.forEach(q => {
            qaHTML += `
                <div class="qa-item">
                    <div class="qa-q">❓ ${q.q}</div>
                    <div class="qa-a">✅ ${q.options[q.ans]}</div>
                </div>
            `;
        });
        qaHTML += '</div>';
        
        // Переделали структуру: обернули контент в db-item-body с display: none
        container.innerHTML += `
            <div class="db-item">
                <div class="db-item-header" onclick="toggleDbItem(this)">
                    <div class="db-item-title"><span>Урок ${i}</span> ${item.title}</div>
                    <span class="accordion-arrow">▼</span>
                </div>
                <div class="db-item-body" style="display: none;">
                    <div class="db-item-text">${item.theory}</div>
                    ${qaHTML}
                </div>
            </div>
        `;
    }
    document.getElementById('database-modal').style.display = 'flex';
};

// Функция для раскрытия/закрытия темы в базе
window.toggleDbItem = (headerElement) => {
    const body = headerElement.nextElementSibling;
    const arrow = headerElement.querySelector('.accordion-arrow');
    const item = headerElement.parentElement;
    
    if (body.style.display === 'none') {
        body.style.display = 'block';
        arrow.style.transform = 'rotate(180deg)';
        item.classList.add('active');
    } else {
        body.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
        item.classList.remove('active');
    }
};

// Переменная для подсчета вопросов в Мега-Квизе
let megaQuizTotal = 0;

// Логика кнопки "🔥 Мега-Квиз"
document.getElementById('mega-quiz-btn').onclick = () => {
    activeQuizLevel = 'mega'; 
    quizQueue = []; 
    
    const totalLevels = Object.keys(db).length;
    for (let i = 1; i <= totalLevels; i++) {
        db[i].questions.forEach(q => {
            quizQueue.push({...q});
        });
    }
    
    megaQuizTotal = quizQueue.length; 
    
    // Фиксируем количество вопросов для Мега-Квиза
    quizTotalCount = quizQueue.length;
    quizCorrectCount = 0;
    
    document.getElementById('quiz-modal').style.display = 'flex';
    renderNextQuestion();
};

// Логика кнопки "Начать заново"
document.getElementById('restart-btn').onclick = () => {
    document.getElementById('restart-modal').style.display = 'flex';
};

document.getElementById('confirm-restart-btn').onclick = () => {
    currentLevelUnlocked = 1; 
    localStorage.removeItem('geoProgress'); 
    renderMap(); 
    closeModal('restart-modal'); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
};

// Переключатель темы
document.getElementById('theme-toggle').onclick = () => {
    document.body.classList.toggle('dark-mode');
};

// Открыть все
document.getElementById('unlock-all-btn').onclick = () => {
    currentLevelUnlocked = Object.keys(db).length;
    renderMap();
};

init();