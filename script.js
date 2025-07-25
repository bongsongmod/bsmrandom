// 전역 변수
let currentScreen = 'setup';
let drawData = {};
let participantData = {};
let manualParticipants = []; // 참가자 이름 배열
let globalMultiplier = 1; // 전체 배율
let currentTierIndex = 0;
let currentWinnerIndex = 0;
let animationInterval;
let winners = [];

// CSV 데이터를 별도로 관리
window.csvData = {};

// 화면 전환 함수
function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenName + 'Screen').classList.add('active');
  currentScreen = screenName;
  
  // 메인 화면(setup)에서만 footer 표시
  const footer = document.querySelector('.footer');
  if (screenName === 'setup') {
    footer.classList.remove('hidden');
  } else {
    footer.classList.add('hidden');
  }
}

// 등수 추가 함수
function addPrizeTier() {
  const container = document.getElementById('prizeTiers');
  const tierCount = container.children.length;
  const tierNames = ['1등', '2등', '3등', '4등', '5등'];
  
  const tierDiv = document.createElement('div');
  tierDiv.className = 'prize-tier';
  tierDiv.innerHTML = `
    <span class="tier-label">
      ${tierNames[tierCount] || (tierCount + 1) + '등'}
      <button type="button" class="delete-btn" onclick="removePrizeTier(this)" title="삭제">×</button>
    </span>
    <input type="number" class="prize-count" min="1" placeholder="당첨자 수" value="1">
  `;
  container.appendChild(tierDiv);
  
  // 라벨 업데이트
  updateTierLabels();
}

// 등수 삭제 함수
function removePrizeTier(button) {
  const container = document.getElementById('prizeTiers');
  if (container.children.length > 1) {
    button.parentElement.parentElement.remove();
    updateTierLabels();
  }
}

// 등수 라벨 업데이트 함수
function updateTierLabels() {
  const container = document.getElementById('prizeTiers');
  const tiers = container.children;
  
  for (let i = 0; i < tiers.length; i++) {
    const tierLabel = tiers[i].querySelector('.tier-label');
    const textNode = tierLabel.firstChild;
    
    if (tiers.length === 1) {
      textNode.textContent = '당첨자';
    } else {
      const tierNames = ['1등', '2등', '3등', '4등', '5등'];
      textNode.textContent = tierNames[i] || (i + 1) + '등';
    }
  }
}

// CSV 파일 업로드 처리
function handleCSVUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const csv = e.target.result;
    const lines = csv.split('\n');
    let csvData = {};
    let validCount = 0;
    let invalidCount = 0;
    
    lines.forEach(line => {
      const [number, name, phone] = line.split(',').map(s => s.trim());
      if (number && name) {
        const num = parseInt(number);
        if (!isNaN(num) && num > 0) {
          csvData[num] = {
            name: name,
            phone: phone || ''
          };
          validCount++;
        } else {
          invalidCount++;
        }
      }
    });
    
    // CSV 데이터 저장
    window.csvData = csvData;
    
    // 데이터 병합
    mergeParticipantData();
    
    console.log('참가자 데이터 로드 완료:', validCount, '명');
    if (invalidCount > 0) {
      console.warn('유효하지 않은 데이터:', invalidCount, '건');
    }
    
    // 사용자에게 알림
    const message = `CSV 파일 로드 완료: ${validCount}명의 참가자 정보가 등록되었습니다.`;
    alert(message + (invalidCount > 0 ? `\n(${invalidCount}건의 유효하지 않은 데이터는 제외되었습니다)` : ''));
  };
  reader.readAsText(file);
}

// 추첨 시작 함수
function startDraw() {
  const drawName = document.getElementById('drawName').value.trim();
  const totalParticipants = parseInt(document.getElementById('totalParticipants').value);
  
  if (!drawName) {
    alert('추첨명을 입력해주세요.');
    return;
  }
  
  if (!totalParticipants || totalParticipants < 1) {
    alert('올바른 참여 인원수를 입력해주세요.');
    return;
  }

  // 당첨 설정 수집
  const prizeTiers = [];
  const tierElements = document.querySelectorAll('.prize-tier');
  let totalWinners = 0;
  
  tierElements.forEach((tier, index) => {
    const count = parseInt(tier.querySelector('.prize-count').value);
    
    if (count && count > 0) {
      prizeTiers.push({
        tier: index + 1,
        count: count,
        name: `${index + 1}등`
      });
      totalWinners += count;
    }
  });

  if (totalWinners > totalParticipants) {
    alert('당첨자 수가 참여 인원수보다 많습니다.');
    return;
  }

  // CSV 데이터 유효성 검증
  if (Object.keys(participantData).length > 0) {
    const csvNumbers = Object.keys(participantData).map(n => parseInt(n));
    const invalidNumbers = csvNumbers.filter(n => n > totalParticipants);
    
    if (invalidNumbers.length > 0) {
      const proceed = confirm(
        `CSV 파일에 참여인원 범위를 벗어난 번호가 있습니다.\n` +
        `(${invalidNumbers.slice(0, 5).join(', ')}${invalidNumbers.length > 5 ? ' 등' : ''})\n\n` +
        `이 번호들은 추첨에서 제외됩니다. 계속하시겠습니까?`
      );
      
      if (!proceed) return;
      
      // 범위를 벗어난 데이터 제거
      invalidNumbers.forEach(num => {
        delete participantData[num];
      });
    }
  }

  // 추첨 데이터 설정
  drawData = {
    name: drawName,
    totalParticipants: totalParticipants,
    prizeTiers: prizeTiers,
    totalWinners: totalWinners,
    startTime: new Date()
  };

  // 화면 전환 및 초기화
  showScreen('draw');
  initializeDrawScreen();
}

// 추첨 화면 초기화
function initializeDrawScreen() {
  document.getElementById('drawTitle').textContent = `${drawData.name} - 추첨 진행`;
  
  // 숫자 그리드 생성
  const numbersGrid = document.getElementById('numbersGrid');
  numbersGrid.innerHTML = '';
  
  // 그리드 크기 계산 (450px 높이, 15px 패딩)
  const gridHeight = 420; // 450 - 30 (패딩)
  const gridWidth = numbersGrid.clientWidth || 800; // 기본값
  
  // 참여자 수에 따른 셀 크기 계산
  const totalParticipants = drawData.totalParticipants;
  let cellSize, fontSize, cols, rows, isCompactMode = false;
  
  // 최적의 그리드 크기 계산 - 더 정확한 계산
  let bestFit = null;
  
  // 일반 모드에서 최적 크기 찾기
  for (let size = 50; size >= 12; size -= 1) {
    const gap = size > 20 ? 3 : 2;
    cols = Math.floor((gridWidth + gap) / (size + gap));
    rows = Math.ceil(totalParticipants / cols);
    const totalHeight = rows * size + (rows - 1) * gap;
    
    if (totalHeight <= gridHeight && cols > 0) {
      bestFit = {
        size: size,
        fontSize: Math.max(8, Math.floor(size * 0.28)),
        cols: cols,
        rows: rows,
        gap: gap,
        isCompact: false
      };
      break;
    }
  }
  
  // 일반 모드로 안 되면 컴팩트 모드
  if (!bestFit) {
    for (let size = 12; size >= 4; size -= 1) {
      const gap = 1;
      cols = Math.floor((gridWidth + gap) / (size + gap));
      rows = Math.ceil(totalParticipants / cols);
      const totalHeight = rows * size + (rows - 1) * gap;
      
      if (totalHeight <= gridHeight && cols > 0) {
        bestFit = {
          size: size,
          fontSize: 0,
          cols: cols,
          rows: rows,
          gap: gap,
          isCompact: true
        };
        break;
      }
    }
  }
  
  // 최종 설정
  if (bestFit) {
    cellSize = bestFit.size;
    fontSize = bestFit.fontSize;
    cols = bestFit.cols;
    isCompactMode = bestFit.isCompact;
  } else {
    // 최후의 수단
    cellSize = 4;
    fontSize = 0;
    cols = Math.floor(gridWidth / 5);
    isCompactMode = true;
  }
  
  // 그리드 스타일 설정
  const gap = isCompactMode ? 1 : 3;
  numbersGrid.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
  numbersGrid.style.gap = `${gap}px`;
  
  for (let i = 1; i <= drawData.totalParticipants; i++) {
    const cell = document.createElement('div');
    cell.className = isCompactMode ? 'number-cell compact' : 'number-cell';
    cell.textContent = isCompactMode ? '' : i;
    cell.id = `number-${i}`;
    cell.title = `${i}번`; // 툴팁으로 번호 표시
    cell.style.width = `${cellSize}px`;
    cell.style.height = `${cellSize}px`;
    if (!isCompactMode) {
      cell.style.fontSize = `${fontSize}px`;
    }
    numbersGrid.appendChild(cell);
  }

  // 당첨자 목록 초기화
  document.getElementById('winnersDisplay').innerHTML = '';
  currentTierIndex = 0;
  currentWinnerIndex = 0;
  winners = [];
  
  // 버튼 상태 초기화
  const drawButton = document.getElementById('drawButton');
  const finishButton = document.getElementById('finishButton');
  drawButton.style.display = 'inline-block';
  drawButton.disabled = false;
  drawButton.textContent = '추첨하기';
  finishButton.style.display = 'none';
}

// 다음 추첨 실행
function drawNext() {
  // 추첨 가능한 번호들 (이미 당첨된 번호 제외)
  const availableNumbers = [];
  for (let i = 1; i <= drawData.totalParticipants; i++) {
    if (!winners.find(w => w.number === i)) {
      availableNumbers.push(i);
    }
  }

  if (availableNumbers.length === 0) {
    finishDraw();
    return;
  }

  // 애니메이션 시작 (모든 당첨자를 한 번에 선택)
  startDrawAnimation(availableNumbers);
}

// 추첨 애니메이션
function startDrawAnimation(availableNumbers) {
  const drawButton = document.getElementById('drawButton');
  drawButton.disabled = true;
  drawButton.textContent = '추첨중...';

  let highlightedNumbers = [];
  let animationCount = 0;
  const maxAnimations = 50 + Math.floor(Math.random() * 50); // 50-100회 애니메이션

  animationInterval = setInterval(() => {
    // 이전 하이라이트 제거
    highlightedNumbers.forEach(num => {
      const cell = document.getElementById(`number-${num}`);
      if (cell && !cell.classList.contains('winner')) {
        cell.classList.remove('highlight');
      }
    });

    // 새로운 랜덤 번호들 하이라이트 (더 많은 수를 하이라이트)
    highlightedNumbers = [];
    const highlightCount = Math.min(10 + Math.floor(Math.random() * 15), availableNumbers.length);
    
    for (let i = 0; i < highlightCount; i++) {
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const number = availableNumbers[randomIndex];
      if (!highlightedNumbers.includes(number)) {
        highlightedNumbers.push(number);
        const cell = document.getElementById(`number-${number}`);
        if (cell) {
          cell.classList.add('highlight');
        }
      }
    }

    animationCount++;
    if (animationCount >= maxAnimations) {
      clearInterval(animationInterval);
      selectAllWinners(availableNumbers);
    }
  }, 50); // 50ms 간격으로 애니메이션
}

// 모든 당첨자 선택 (암호학적으로 안전한 난수 사용)
function selectAllWinners(availableNumbers) {
  // 이전 하이라이트 제거
  document.querySelectorAll('.number-cell.highlight').forEach(cell => {
    cell.classList.remove('highlight');
  });

  // 필요한 총 당첨자 수 계산
  const totalWinnersNeeded = drawData.totalWinners;
  const selectedNumbers = [];

  // 암호학적으로 안전한 난수로 모든 당첨자 선택
  for (let i = 0; i < totalWinnersNeeded && availableNumbers.length > 0; i++) {
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    const randomIndex = randomArray[0] % availableNumbers.length;
    const winnerNumber = availableNumbers.splice(randomIndex, 1)[0];
    selectedNumbers.push(winnerNumber);
  }

  // 등수별로 당첨자 배정
  let winnerIndex = 0;
  drawData.prizeTiers.forEach(tier => {
    for (let i = 0; i < tier.count && winnerIndex < selectedNumbers.length; i++) {
      const winnerNumber = selectedNumbers[winnerIndex];
      
      // 당첨자 정보 저장
      const winner = {
        number: winnerNumber,
        tier: tier.tier,
        tierName: tier.name,
        participant: participantData[winnerNumber] || null
      };
      winners.push(winner);

      // 당첨 번호 표시
      const winnerCell = document.getElementById(`number-${winnerNumber}`);
      if (winnerCell) {
        winnerCell.classList.add('winner');
      }

      winnerIndex++;
    }
  });

  // 당첨자 표시 업데이트
  updateWinnersDisplay();

  // 추첨 완료 처리
  const drawButton = document.getElementById('drawButton');
  drawButton.style.display = 'none';
  document.getElementById('finishButton').style.display = 'inline-block';
}

// 당첨자 표시 업데이트
function updateWinnersDisplay() {
  const winnersDisplay = document.getElementById('winnersDisplay');
  winnersDisplay.innerHTML = '';
  
  // 등수별로 그룹화
  const tierGroups = {};
  const hasMultipleTiers = drawData.prizeTiers.length > 1;
  
  winners.forEach(winner => {
    if (!tierGroups[winner.tier]) {
      tierGroups[winner.tier] = {
        name: hasMultipleTiers ? winner.tierName : '당첨',
        numbers: []
      };
    }
    tierGroups[winner.tier].numbers.push(winner.number);
  });
  
  // 레이아웃 결정 (등수가 많고 각 등수당 당첨자가 적으면 컴팩트 레이아웃)
  const tierCount = Object.keys(tierGroups).length;
  const avgWinnersPerTier = winners.length / tierCount;
  const useCompactLayout = tierCount >= 3 && avgWinnersPerTier <= 4;
  
  if (useCompactLayout) {
    winnersDisplay.className = 'winners-display compact-layout';
  } else {
    winnersDisplay.className = 'winners-display';
  }
  
  // 등수별로 표시
  Object.keys(tierGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(tier => {
    const group = tierGroups[tier];
    const tierDiv = document.createElement('div');
    tierDiv.className = useCompactLayout ? 'tier-winners compact' : 'tier-winners';
    
    const sortedNumbers = group.numbers.sort((a, b) => a - b);
    
    // 번호를 이름으로 변환 (참가자 정보가 있는 경우)
    const displayText = sortedNumbers.map(num => {
      const participant = participantData[num];
      return participant ? participant.name : num;
    }).join(', ');
    
    tierDiv.innerHTML = `
      <div class="tier-title">${group.name}</div>
      <div class="tier-numbers">${displayText}</div>
    `;
    
    winnersDisplay.appendChild(tierDiv);
  });
}

// 추첨 완료
function finishDraw() {
  drawData.endTime = new Date();
  showScreen('result');
  displayResults();
}

// 추첨 취소
function cancelDraw() {
  if (confirm('추첨을 취소하고 설정 화면으로 돌아가시겠습니까?')) {
    // 애니메이션 정리
    if (animationInterval) {
      clearInterval(animationInterval);
    }
    
    // 데이터 초기화
    winners = [];
    currentTierIndex = 0;
    currentWinnerIndex = 0;
    
    // 메인 화면으로 이동
    showScreen('setup');
  }
}

// 결과 화면 표시
function displayResults() {
  document.getElementById('resultDrawName').textContent = drawData.name;
  document.getElementById('resultDateTime').textContent = 
    drawData.startTime.toLocaleString('ko-KR');
  document.getElementById('resultTotalParticipants').textContent = 
    drawData.totalParticipants.toLocaleString();
  document.getElementById('resultWinnerCount').textContent = 
    winners.length.toLocaleString();

  // 등수가 여러 개인지 확인
  const hasMultipleTiers = drawData.prizeTiers.length > 1;
  
  // 테이블 클래스 설정
  const resultsTable = document.querySelector('.results-table');
  resultsTable.className = hasMultipleTiers ? 'results-table three-columns' : 'results-table two-columns';
  
  // 테이블 헤더 수정
  const tableHead = document.getElementById('resultsTableHead');
  const headerRow = tableHead.querySelector('tr');
  if (hasMultipleTiers) {
    headerRow.innerHTML = `
      <th>순번</th>
      <th>당첨자 정보</th>
      <th>비고</th>
    `;
  } else {
    headerRow.innerHTML = `
      <th>순번</th>
      <th>당첨자 정보</th>
    `;
  }

  // 결과 테이블 생성
  const tableBody = document.getElementById('resultsTableBody');
  tableBody.innerHTML = '';

  // 등수별로 정렬
  const sortedWinners = [...winners].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.number - b.number;
  });

  sortedWinners.forEach((winner, index) => {
    const row = document.createElement('tr');
    
    // 당첨자 정보 생성
    let participantInfo;
    if (winner.participant && winner.participant.name) {
      const phone = winner.participant.phone && winner.participant.phone.trim() ? `(${winner.participant.phone})` : '';
      participantInfo = `${winner.participant.name}${phone}`;
    } else {
      participantInfo = `${winner.number}번`;
    }
    
    if (hasMultipleTiers) {
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${participantInfo}</td>
        <td><span class="tier-badge tier-${winner.tier}">${winner.tierName}</span></td>
      `;
    } else {
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${participantInfo}</td>
      `;
    }
    
    tableBody.appendChild(row);
  });
}

// 결과 다운로드
function downloadResults() {
  const hasMultipleTiers = drawData.prizeTiers.length > 1;
  const headerColumns = hasMultipleTiers ? "순번,당첨번호,이름,전화번호,등수\n" : "순번,당첨번호,이름,전화번호,결과\n";
  let csvContent = headerColumns;
  
  const sortedWinners = [...winners].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.number - b.number;
  });

  sortedWinners.forEach((winner, index) => {
    const name = winner.participant ? winner.participant.name : `참가자${winner.number}번`;
    const phone = winner.participant ? winner.participant.phone : '';
    const resultText = hasMultipleTiers ? winner.tierName : '당첨';
    csvContent += `${index + 1},${winner.number},${name},${phone},${resultText}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  // 파일명에 날짜와 시간 포함
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
  const fileName = `${drawData.name}_결과_${dateStr}_${timeStr}.csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 시스템 초기화
function resetSystem() {
  if (confirm('새로운 추첨을 시작하시겠습니까? 현재 결과가 삭제됩니다.')) {
    drawData = {};
    participantData = {};
    manualParticipants = [];
    globalMultiplier = 1;
    window.csvData = {};
    winners = [];
    currentTierIndex = 0;
    currentWinnerIndex = 0;
    
    // 폼 초기화
    document.getElementById('drawName').value = '';
    document.getElementById('totalParticipants').value = '';
    document.getElementById('csvFile').value = '';
    
    // 등수 설정 초기화
    const prizeTiers = document.getElementById('prizeTiers');
    prizeTiers.innerHTML = `
      <div class="prize-tier">
        <span class="tier-label">당첨자</span>
        <input type="number" class="prize-count" min="1" placeholder="당첨자 수" value="1">
      </div>
    `;
    
    showScreen('setup');
  }
}

// 참가자 입력 모달 열기
function openParticipantInput() {
  document.getElementById('participantModal').style.display = 'block';
  updateParticipantDisplay();
  
  // 입력창에 포커스 (약간의 지연을 두어 확실히 포커스)
  setTimeout(() => {
    const input = document.getElementById('participantInput');
    input.focus();
    input.value = ''; // 입력창 비우기
  }, 100);
}

// 참가자 입력 모달 닫기
function closeParticipantModal() {
  document.getElementById('participantModal').style.display = 'none';
  document.getElementById('participantInput').value = '';
  // 배율은 유지 (전체 배율이므로)
}

// 키다운 이벤트 처리 (백스페이스)
function handleParticipantKeydown(event) {
  if (event.key === 'Backspace') {
    const input = event.target;
    // 입력창이 완전히 비어있고 참가자가 있을 때만 삭제
    if (input.value === '' && manualParticipants.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      removeParticipant(manualParticipants.length - 1);
      console.log('백스페이스로 참가자 삭제:', manualParticipants.length);
    }
  }
}

// 키프레스 이벤트 처리 (엔터키)
function handleParticipantKeypress(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    addParticipant();
  }
}

// 참가자 추가
function addParticipant() {
  const input = document.getElementById('participantInput');
  const name = input.value.trim();
  
  if (name) {
    manualParticipants.push(name);
    input.value = '';
    updateParticipantDisplay();
    
    // 포커스 유지 (약간의 지연)
    setTimeout(() => {
      input.focus();
    }, 10);
    
    console.log('참가자 추가됨:', name, '총:', manualParticipants.length);
  }
}

// 참가자 제거
function removeParticipant(index) {
  const removedName = manualParticipants[index];
  manualParticipants.splice(index, 1);
  updateParticipantDisplay();
  
  // 입력창에 포커스 유지
  setTimeout(() => {
    const input = document.getElementById('participantInput');
    if (input) {
      input.focus();
    }
  }, 10);
  
  console.log('참가자 제거됨:', removedName, '남은 수:', manualParticipants.length);
}

// 전체 배율 업데이트
function updateGlobalMultiplier() {
  const multiplierInput = document.getElementById('multiplierInput');
  globalMultiplier = parseInt(multiplierInput.value) || 1;
  updateParticipantDisplay();
}

// 참가자 목록 표시 업데이트
function updateParticipantDisplay() {
  const display = document.getElementById('participantListDisplay');
  const count = document.getElementById('participantCount');
  
  // 총 참가자 수 계산 (배율 적용)
  const totalCount = manualParticipants.length * globalMultiplier;
  
  count.textContent = `총 ${totalCount}명`;
  
  if (manualParticipants.length === 0) {
    display.innerHTML = '<p style="text-align: center; color: #6c757d; margin: 20px 0;">아직 입력된 참가자가 없습니다.</p>';
  } else {
    display.innerHTML = manualParticipants.map((name, index) => `
      <div class="participant-item">
        <span class="participant-number">${index + 1}</span>
        <div class="participant-name">
          <span>${name}</span>
          ${globalMultiplier > 1 ? `<span class="participant-multiplier">x${globalMultiplier}</span>` : ''}
        </div>
        <button class="remove-participant" onclick="removeParticipant(${index})">삭제</button>
      </div>
    `).join('');
  }
}

// 참가자 입력 완료
function completeParticipantInput() {
  if (manualParticipants.length === 0) {
    alert('참가자를 최소 1명 이상 입력해주세요.');
    return;
  }
  
  // 데이터 병합
  mergeParticipantData();
  
  // 모달 닫기
  closeParticipantModal();
  
  // 사용자에게 알림
  const totalManualCount = manualParticipants.length * globalMultiplier;
  alert(`${manualParticipants.length}명의 참가자가 등록되었습니다. (배율 적용: 총 ${totalManualCount}명)\n총 참여자 수가 자동으로 설정되었습니다.`);
}

// 참가자 데이터 병합 함수
function mergeParticipantData() {
  // 기존 participantData 초기화
  participantData = {};
  let currentIndex = 1;
  
  // 직접 입력 데이터를 1번부터 배치 (전체 배율 적용)
  manualParticipants.forEach((name) => {
    for (let i = 0; i < globalMultiplier; i++) {
      participantData[currentIndex] = {
        name: name,
        phone: ''
      };
      currentIndex++;
    }
  });
  
  // CSV 데이터를 그 다음 번호부터 배치
  if (window.csvData) {
    Object.values(window.csvData).forEach(participant => {
      participantData[currentIndex] = participant;
      currentIndex++;
    });
  }
  
  // 총 참여자 수 자동 계산 및 설정
  const totalWithData = Object.keys(participantData).length;
  const currentTotal = parseInt(document.getElementById('totalParticipants').value) || 0;
  const newTotal = Math.max(totalWithData, currentTotal);
  
  document.getElementById('totalParticipants').value = newTotal;
  
  // 직접입력 총 개수 계산 (배율 적용)
  const manualTotal = manualParticipants.length * globalMultiplier;
  const csvTotal = window.csvData ? Object.keys(window.csvData).length : 0;
  
  console.log(`참가자 데이터 병합 완료: 직접입력 ${manualParticipants.length}명(총 ${manualTotal}명), CSV ${csvTotal}명, 총 ${newTotal}명`);
}

// 추첨 수정 함수
function modifyDraw() {
  if (confirm('현재 추첨 결과를 유지한 채로 설정을 수정하시겠습니까?')) {
    // 결과 데이터는 유지하고 설정 화면으로 이동
    showScreen('setup');
  }
}

// 모달 외부 클릭시 닫기
window.onclick = function(event) {
  const modal = document.getElementById('participantModal');
  if (event.target === modal) {
    closeParticipantModal();
  }
}

// jsPDF 및 autoTable 플러그인 동적 로드
(function() {
  if (!window.jspdfLoaded) {
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = function() {
      window.jspdfLoaded = true;
      // autoTable 플러그인도 로드
      if (!window.jspdfAutoTableLoaded) {
        var autoTableScript = document.createElement('script');
        autoTableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
        autoTableScript.onload = function() { window.jspdfAutoTableLoaded = true; };
        document.head.appendChild(autoTableScript);
      }
    };
    document.head.appendChild(script);
  } else if (!window.jspdfAutoTableLoaded) {
    var autoTableScript = document.createElement('script');
    autoTableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
    autoTableScript.onload = function() { window.jspdfAutoTableLoaded = true; };
    document.head.appendChild(autoTableScript);
  }
})();

// PDF 설정 모달 열기
function openPDFSettingsModal() {
  document.getElementById('pdfSettingsModal').style.display = 'block';
  // 다운로드 버튼 비활성화 및 로딩 메시지 표시
  const downloadBtn = document.querySelector('#pdfSettingsModal .btn.btn-primary');
  downloadBtn.disabled = true;
  downloadBtn.textContent = '로딩 중...';
  // jsPDF 및 autoTable 로드 체크
  function enableBtnWhenReady() {
    if (window.jspdfLoaded && window.jspdf && window.jspdfAutoTableLoaded) {
      downloadBtn.disabled = false;
      downloadBtn.textContent = '다운로드';
    } else {
      setTimeout(enableBtnWhenReady, 200);
    }
  }
  enableBtnWhenReady();
}
// PDF 설정 모달 닫기
function closePDFSettingsModal() {
  document.getElementById('pdfSettingsModal').style.display = 'none';
}

// PDF 다운로드 함수 (옵션 적용)
function downloadPDFWithOptions() {
  if (
    !window.jspdfLoaded ||
    !window.jspdf ||
    !window.jspdf.jsPDF ||
    !window.jspdf.jsPDF.API ||
    typeof window.jspdf.jsPDF.API.autoTable !== 'function'
  ) {
    alert('PDF 라이브러리가 아직 로드되지 않았거나 autoTable 플러그인이 연결되지 않았습니다. 잠시 후 다시 시도해주세요.');
    return;
  }
  const doc = new window.jspdf.jsPDF();
  if (typeof doc.autoTable !== 'function') {
    alert('autoTable 플러그인이 정상적으로 연결되지 않았습니다. 네트워크 환경을 확인하거나 새로고침 해주세요.');
    closePDFSettingsModal();
    return;
  }
  // 옵션 읽기
  const form = document.getElementById('pdfOptionsForm');
  const checked = Array.from(form.elements['pdfField']).filter(cb => cb.checked).map(cb => cb.value);
  if (checked.length === 0) {
    alert('최소 1개 이상의 항목을 선택하세요.');
    return;
  }

  // 추첨 정보
  const drawName = document.getElementById('resultDrawName').textContent;
  const dateTime = document.getElementById('resultDateTime').textContent;
  const totalParticipants = document.getElementById('resultTotalParticipants').textContent;
  const winnerCount = document.getElementById('resultWinnerCount').textContent;

  let y = 15;
  doc.setFontSize(18);
  doc.text(drawName, 105, y, { align: 'center' });
  y += 10;
  doc.setFontSize(11);
  doc.text(`추첨일시: ${dateTime}`, 105, y, { align: 'center' });
  y += 7;
  doc.text(`총 참여자: ${totalParticipants}   당첨자 수: ${winnerCount}`, 105, y, { align: 'center' });
  y += 10;

  // 표 헤더
  let headers = ['순번'];
  if (checked.includes('number')) headers.push('번호');
  if (checked.includes('name')) headers.push('이름');
  if (checked.includes('phone')) headers.push('전화번호');

  // 표 데이터
  const tableBody = document.getElementById('resultsTableBody');
  const rows = Array.from(tableBody.querySelectorAll('tr'));
  let data = [];
  rows.forEach((row, idx) => {
    let cols = row.querySelectorAll('td');
    let rowData = [String(idx + 1)];
    let name = '', number = '', phone = '';
    // 이름/번호/전화번호 추출
    if (cols.length > 1) {
      // 이름/번호/전화번호가 한 셀에 있을 수 있음
      const info = cols[1].textContent;
      // 이름(번호) 형태 분리
      const match = info.match(/([가-힣a-zA-Z0-9]+)(\((\d+)\))?/);
      if (match) {
        name = match[1];
        number = match[3] || '';
      } else {
        name = info;
      }
      // 전화번호가 ()로 붙는 경우
      const phoneMatch = info.match(/\((01[0-9]-\d{3,4}-\d{4})\)/);
      if (phoneMatch) phone = phoneMatch[1];
    }
    if (checked.includes('number')) rowData.push(number);
    if (checked.includes('name')) rowData.push(name);
    if (checked.includes('phone')) rowData.push(phone);
    data.push(rowData);
  });

  // 표 그리기
  doc.autoTable({
    head: [headers],
    body: data,
    startY: y,
    styles: { font: 'malgun', fontSize: 11 },
    headStyles: { fillColor: [52, 152, 219] },
    margin: { left: 15, right: 15 }
  });

  // 하단 문구
  doc.setFontSize(10);
  doc.text('brought to you by BSM', 105, 285, { align: 'center' });

  doc.save(`${drawName}_결과.pdf`);
  closePDFSettingsModal();
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
  console.log('공식 랜덤 추첨 시스템이 로드되었습니다.');
  console.log('암호학적으로 안전한 난수 생성을 사용합니다.');
}); 