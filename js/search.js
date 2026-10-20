/**
 * Underdark Item Search Engine
 * - 한글 초성 검색 (Chosung Search)
 * - 띄어쓰기/특수문자 무시 이름 & 별칭 매칭
 * - 능력 문장 텍스트 검색 (AND 검색)
 * - 스탯 수치 쿼리 검색 (예: '치피>=100', '투사체>2', '이감>=20')
 * - 각성 단계(0~5) 반영 수치 비교
 */

(function (window) {
  'use strict';

  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

  function getChosung(str) {
    if (!str) return '';
    let result = '';
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i) - 0xac00;
      if (code >= 0 && code < 11172) {
        result += CHO[Math.floor(code / 588)];
      } else if (/[0-9a-zA-Z가-힣]/.test(str[i])) {
        result += str[i].toLowerCase();
      }
    }
    return result;
  }

  function normalize(str) {
    if (!str) return '';
    return str.toString().replace(/[\s/·,.\-_()[\]+~]+/g, '').toLowerCase();
  }

  // 검색 연산자 정규식 (예: 치피>=100, 투사체>2, 영공속<=50, 이감=20)
  const OP_REGEX = /^([a-zA-Z0-9가-힣]+)(>=|<=|>|<|=)([0-9.]+)$/;

  class SearchEngine {
    constructor(data) {
      this.raw = data;
      this.items = data.items || [];
      this.statDefs = data.statDefs || {};
      this.tagDefs = data.tagDefs || {};
      this.categories = data.categories || [];
      this.drops = data.drops || [];

      // 스탯 별칭 역방향 맵 (예: '치피' -> 'hero_crit_dmg')
      this.aliasMap = {};
      Object.entries(this.statDefs).forEach(([key, info]) => {
        this.aliasMap[normalize(info.label)] = key;
        this.aliasMap[normalize(key)] = key;
        if (info.aliases) {
          info.aliases.forEach(alias => {
            this.aliasMap[normalize(alias)] = key;
          });
        }
      });
    }

    /**
     * @param {Object} options
     * @param {string} options.query - 사용자가 입력한 검색어
     * @param {string} options.category - 선택된 카테고리 ('all' or 'weapon', 'sub' 등)
     * @param {string} options.range - 근거리 / 원거리 필터 ('all', '근거리', '원거리')
     * @param {string} options.tier - 등급 티어 필터 ('all', 'S', 'A', 'B', ...)
     * @param {string} options.usage - 사용 여부 ('all', 'O', '△', 'X')
     * @param {Array<string>} options.tags - 선택된 특성 태그 목록
     * @param {string} options.drop - 선택된 드랍처
     * @param {number} options.awakeningLevel - 현재 선택된 각성 단계 (0 ~ 5)
     * @param {string} options.sortBy - 정렬 기준 ('default', 'grade', 'name', or statKey)
     * @param {string} options.sortOrder - 정렬 방향 ('asc', 'desc')
     */
    search(options = {}) {
      const {
        query = '',
        category = 'all',
        range = 'all',
        tier = 'all',
        usage = 'all',
        tags = [],
        drop = 'all',
        awakeningLevel = 0,
        sortBy = 'default',
        sortOrder = 'desc',
      } = options;

      const tokens = query.trim().split(/\s+/).filter(Boolean);
      const textTokens = [];
      const statQueries = [];

      tokens.forEach(tok => {
        const m = tok.match(OP_REGEX);
        if (m) {
          const rawKey = normalize(m[1]);
          const op = m[2];
          const val = parseFloat(m[3]);
          const resolvedKey = this.aliasMap[rawKey];
          if (resolvedKey) {
            statQueries.push({ key: resolvedKey, op, val });
          } else {
            textTokens.push(tok);
          }
        } else {
          textTokens.push(tok);
        }
      });

      const results = [];

      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];

        // 1. 카테고리 필터
        if (category !== 'all' && item.cat !== category) continue;

        // 2. 사거리 필터 (근거리/원거리)
        if (range !== 'all' && item.range && !item.range.includes(range)) continue;

        // 3. 등급 필터
        if (tier !== 'all' && item.tier !== tier) continue;

        // 4. 사용여부 필터 (O, △, X)
        if (usage !== 'all' && item.usage !== usage) continue;

        // 5. 드랍처 필터
        if (drop !== 'all' && (!item.drops || !item.drops.includes(drop))) continue;

        // 6. 특성 태그 필터 (AND 조건)
        if (tags.length > 0) {
          const itemTags = Object.keys(item.tags || {});
          const hasAllTags = tags.every(t => itemTags.includes(t));
          if (!hasAllTags) continue;
        }

        // 7. 수치 쿼리 검사 (각성 레벨 적용)
        let passStat = true;
        for (const sq of statQueries) {
          const vals = item.stats ? item.stats[sq.key] : null;
          if (!vals) {
            passStat = false;
            break;
          }
          let currentVal = vals[awakeningLevel];
          if (currentVal === null || currentVal === undefined) {
            for (let lv = awakeningLevel; lv >= 0; lv--) {
              if (vals[lv] !== null && vals[lv] !== undefined) {
                currentVal = vals[lv];
                break;
              }
            }
          }
          if (currentVal === null || currentVal === undefined) {
            passStat = false;
            break;
          }

          if (sq.op === '>=' && !(currentVal >= sq.val)) passStat = false;
          else if (sq.op === '<=' && !(currentVal <= sq.val)) passStat = false;
          else if (sq.op === '>' && !(currentVal > sq.val)) passStat = false;
          else if (sq.op === '<' && !(currentVal < sq.val)) passStat = false;
          else if (sq.op === '=' && !(Math.abs(currentVal - sq.val) < 0.001)) passStat = false;

          if (!passStat) break;
        }
        if (!passStat) continue;

        // 8. 텍스트 토큰 검색 및 스코어 계산
        let matchScore = 0;
        let passText = true;

        if (textTokens.length > 0) {
          const nameNorm = item.search.name;
          const choNorm = item.search.cho;
          const textNorm = item.search.text;
          const aliasNorms = item.search.alias || [];
          const aliasChos = item.search.aliasCho || [];
          const commentNorm = item.search.comment || '';
          const dropNorm = item.search.drops || '';

          for (const tok of textTokens) {
            const tNorm = normalize(tok);
            const tCho = getChosung(tok);
            let tokenMatched = false;

            // 1) 정확한 이름 매칭
            if (nameNorm === tNorm) {
              matchScore += 100;
              tokenMatched = true;
            }
            // 2) 이름 부분 일치
            else if (nameNorm.includes(tNorm)) {
              matchScore += 60;
              tokenMatched = true;
            }
            // 3) 별칭 일치 (예: 빛단, 핏단 등)
            else if (aliasNorms.some(a => a.includes(tNorm))) {
              matchScore += 55;
              tokenMatched = true;
            }
            // 4) 초성 일치 (이름 또는 별칭)
            else if (choNorm.includes(tCho) || aliasChos.some(ac => ac.includes(tCho))) {
              matchScore += 50;
              tokenMatched = true;
            }
            // 5) 능력 문장 텍스트 일치
            else if (textNorm.includes(tNorm)) {
              matchScore += 30;
              tokenMatched = true;
            }
            // 6) 코멘트 및 드랍처 일치
            else if (commentNorm.includes(tNorm) || dropNorm.includes(tNorm)) {
              matchScore += 15;
              tokenMatched = true;
            }

            if (!tokenMatched) {
              passText = false;
              break;
            }
          }
        } else {
          // 검색어가 없을 때는 기본 우선순위
          matchScore = 10;
        }

        if (passText) {
          results.push({ item, score: matchScore });
        }
      }

      // 9. 정렬 (Sorting)
      results.sort((a, b) => {
        // 특정 스탯 기준 정렬 요청 시
        if (sortBy !== 'default' && sortBy !== 'grade' && sortBy !== 'name' && this.statDefs[sortBy]) {
          const getVal = it => {
            const vals = it.stats ? it.stats[sortBy] : null;
            if (!vals) return -999999;
            let v = vals[awakeningLevel];
            if (v === null || v === undefined) {
              for (let lv = awakeningLevel; lv >= 0; lv--) {
                if (vals[lv] !== null && vals[lv] !== undefined) return vals[lv];
              }
              return -999999;
            }
            return v;
          };
          const va = getVal(a.item);
          const vb = getVal(b.item);
          return sortOrder === 'asc' ? va - vb : vb - va;
        }

        // 등급 순 정렬
        if (sortBy === 'grade') {
          const ra = a.item.gradeRank !== null ? a.item.gradeRank : 999;
          const rb = b.item.gradeRank !== null ? b.item.gradeRank : 999;
          return sortOrder === 'asc' ? rb - ra : ra - rb;
        }

        // 이름 순 정렬
        if (sortBy === 'name') {
          return sortOrder === 'asc'
            ? a.item.name.localeCompare(b.item.name, 'ko')
            : b.item.name.localeCompare(a.item.name, 'ko');
        }

        // 기본 정렬: 검색 매칭 스코어 -> 등급(S+순) -> 순번
        if (b.score !== a.score) return b.score - a.score;
        const ra = a.item.gradeRank !== null ? a.item.gradeRank : 999;
        const rb = b.item.gradeRank !== null ? b.item.gradeRank : 999;
        if (ra !== rb) return ra - rb;
        return a.item.no - b.item.no;
      });

      return results.map(r => r.item);
    }

    /**
     * Search Heroes
     */
    searchHeroes(heroes = [], options = {}) {
      const { query = '', tier = 'all', grade = 'all' } = options;
      const tokens = query.trim().split(/\s+/).filter(Boolean);

      return heroes.filter(h => {
        if (tier !== 'all' && h.tier !== tier) return false;
        if (grade !== 'all' && h.grade !== grade) return false;

        if (tokens.length === 0) return true;

        const nameNorm = h.search ? h.search.name : normalize(h.name);
        const choNorm = h.search ? h.search.cho : getChosung(h.name);
        const aliasNorms = h.search ? h.search.alias : (h.aliases || []).map(normalize);
        const textNorm = h.search ? h.search.text : normalize(h.ability);

        return tokens.every(tok => {
          const tNorm = normalize(tok);
          const tCho = getChosung(tok);

          return (
            nameNorm.includes(tNorm) ||
            choNorm.includes(tCho) ||
            aliasNorms.some(a => a.includes(tNorm)) ||
            textNorm.includes(tNorm)
          );
        });
      });
    }

    /**
     * Search Mercenaries
     */
    searchMercenaries(mercs = [], options = {}) {
      const { query = '', grade = 'all', recommend = 'all' } = options;
      const tokens = query.trim().split(/\s+/).filter(Boolean);

      return mercs.filter(m => {
        if (grade !== 'all' && m.grade !== grade) return false;
        if (recommend !== 'all' && m.recommend !== recommend) return false;

        if (tokens.length === 0) return true;

        const nameNorm = m.search ? m.search.name : normalize(m.name);
        const choNorm = m.search ? m.search.cho : getChosung(m.name);
        const textNorm = m.search ? m.search.text : normalize(m.ability);

        return tokens.every(tok => {
          const tNorm = normalize(tok);
          const tCho = getChosung(tok);

          return (
            nameNorm.includes(tNorm) ||
            choNorm.includes(tCho) ||
            textNorm.includes(tNorm)
          );
        });
      });
    }

    /**
     * Search Mounts
     */
    searchMounts(mounts = [], options = {}) {
      const { query = '' } = options;
      const tokens = query.trim().split(/\s+/).filter(Boolean);

      return mounts.filter(m => {
        if (tokens.length === 0) return true;

        const nameNorm = m.search ? m.search.name : normalize(m.name);
        const choNorm = m.search ? m.search.cho : getChosung(m.name);
        const textNorm = m.search ? m.search.text : normalize(m.ability + (m.comment || ''));

        return tokens.every(tok => {
          const tNorm = normalize(tok);
          const tCho = getChosung(tok);

          return (
            nameNorm.includes(tNorm) ||
            choNorm.includes(tCho) ||
            textNorm.includes(tNorm)
          );
        });
      });
    }

    /**
     * Search Pets
     */
    searchPets(pets = [], options = {}) {
      const { query = '', tier = 'all', drop = 'all' } = options;
      const tokens = query.trim().split(/\s+/).filter(Boolean);

      return pets.filter(p => {
        if (tier !== 'all') {
          if (tier === 'S_group' && !p.tier.startsWith('S')) return false;
          else if (tier === 'A_group' && !p.tier.startsWith('A')) return false;
          else if (tier === 'B_group' && !p.tier.startsWith('B')) return false;
          else if (tier === 'C_group' && p.tier !== 'C') return false;
          else if (tier === 'D_group' && !p.tier.startsWith('D')) return false;
          else if (tier === 'E_group' && !p.tier.startsWith('E')) return false;
          else if (tier === 'F_group' && !p.tier.startsWith('F')) return false;
          else if (!tier.endsWith('_group') && p.tier !== tier) return false;
        }

        if (drop !== 'all') {
          if (!p.drops.some(d => d.includes(drop) || drop.includes(d))) return false;
        }

        if (tokens.length === 0) return true;

        const nameNorm = p.search ? p.search.name : normalize(p.name);
        const choNorm = p.search ? p.search.cho : getChosung(p.name);
        const textNorm = p.search ? p.search.text : normalize(p.ability + ' ' + (p.dropRaw || ''));

        return tokens.every(tok => {
          const tNorm = normalize(tok);
          const tCho = getChosung(tok);

          return (
            nameNorm.includes(tNorm) ||
            choNorm.includes(tCho) ||
            textNorm.includes(tNorm)
          );
        });
      });
    }
  }

  window.UnderdarkSearch = SearchEngine;
})(window);
