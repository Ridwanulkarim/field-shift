"""
Field Shift - Agronomic Compute Engine (Spec Section 58 & Playbook Architecture)
Architecture: POWER + IMERG + SMAP + NDVI -> cached parquet -> src/compute/agro.py

Deterministic Science Functions:
1. rain_onset(daily_mm, window=7, threshold_mm=20, dry_spell_max=7)
2. growing_degree_days(tmax, tmin, tbase, tupper)
3. compare_onset_distributions(period1_doy, period2_doy) via Mann-Whitney U test
4. sensitivity_check(daily_series, thresholds=[15, 20, 25])
5. generate_advisory_payload(district, crop)
"""

import math
from typing import List, Dict, Any, Tuple, Optional

# Crop-specific growing degree day base temperatures (Celsius)
CROP_GDD_BASES = {
    'Aman Rice': {'tbase': 10.0, 'tupper': 35.0, 'family': 'Cereal'},
    'Boro Rice': {'tbase': 10.0, 'tupper': 35.0, 'family': 'Cereal'},
    'Aus Rice': {'tbase': 10.0, 'tupper': 35.0, 'family': 'Cereal'},
    'Wheat': {'tbase': 5.0, 'tupper': 30.0, 'family': 'Cereal'},
    'Chickpea': {'tbase': 8.0, 'tupper': 32.0, 'family': 'Legume'},
    'Mung Bean': {'tbase': 10.0, 'tupper': 38.0, 'family': 'Legume'},
    'Mustard': {'tbase': 5.0, 'tupper': 28.0, 'family': 'Oilseed'},
    'Lentil': {'tbase': 5.0, 'tupper': 30.0, 'family': 'Legume'},
    'Potato': {'tbase': 7.0, 'tupper': 28.0, 'family': 'Solanaceae'},
    'Maize': {'tbase': 10.0, 'tupper': 38.0, 'family': 'Cereal'},
    'Jute': {'tbase': 12.0, 'tupper': 38.0, 'family': 'Fibre'}
}

def rain_onset(daily_mm: List[float], window: int = 7, threshold_mm: float = 20.0, dry_spell_max: int = 7) -> Optional[int]:
    """
    First day in a 7-day window with 20mm or more that is not followed by a
    dry spell longer than 7 days. State this definition on the slide/page.
    
    Args:
        daily_mm: List of daily rainfall amounts in mm starting from Day 1 (or Day of Year).
        window: Running window size in days (default: 7).
        threshold_mm: Cumulative rainfall threshold in mm (default: 20.0).
        dry_spell_max: Maximum allowed continuous dry days (< 1.0 mm) following onset (default: 7).
        
    Returns:
        Index of the onset day (1-indexed Day of Year), or None if onset criteria not met.
    """
    n = len(daily_mm)
    if n < window:
        return None
        
    for i in range(n - window + 1):
        # Candidate onset day must itself be a wet day (>= 1.0mm)
        if daily_mm[i] < 1.0:
            continue
            
        window_sum = sum(daily_mm[i:i + window])
        if window_sum >= threshold_mm:
            # Check following dry spell constraint
            post_window_start = i + window
            post_window_end = min(n, post_window_start + 21) # check next 3 weeks
            
            dry_spell_exceeded = False
            consecutive_dry = 0
            
            for j in range(post_window_start, post_window_end):
                if daily_mm[j] < 1.0:
                    consecutive_dry += 1
                    if consecutive_dry > dry_spell_max:
                        dry_spell_exceeded = True
                        break
                else:
                    consecutive_dry = 0
                    
            if not dry_spell_exceeded:
                return i + 1 # 1-indexed day of year
                
    return None

def growing_degree_days(tmax: float, tmin: float, tbase: float = 10.0, tupper: float = 35.0) -> float:
    """
    Standard Modified Growing Degree Day (GDD) equation.
    
    GDD = max(0, min(tupper, (tmax + tmin) / 2) - tbase)
    """
    effective_tmax = min(tupper, max(tbase, tmax))
    effective_tmin = min(tupper, max(tbase, tmin))
    tmean = (effective_tmax + effective_tmin) / 2.0
    return max(0.0, tmean - tbase)

def mann_whitney_u_test(x: List[float], y: List[float]) -> Dict[str, Any]:
    """
    Two-sample Mann-Whitney U test (Wilcoxon rank-sum test) for difference in distributions.
    Deterministic implementation without external scipy dependency.
    """
    n1 = len(x)
    n2 = len(y)
    if n1 == 0 or n2 == 0:
        return {'u_stat': 0.0, 'z_score': 0.0, 'p_value': 1.0, 'significant': False}

    # Combined array with tags
    combined = [(val, 1) for val in x] + [(val, 2) for val in y]
    combined.sort(key=lambda item: item[0])

    # Assign fractional ranks for ties
    ranks = [0.0] * len(combined)
    i = 0
    while i < len(combined):
        j = i
        while j < len(combined) - 1 and combined[j][0] == combined[j + 1][0]:
            j += 1
        avg_rank = (i + j + 2) / 2.0  # 1-indexed
        for k in range(i, j + 1):
            ranks[k] = avg_rank
        i = j + 1

    r1 = sum(ranks[idx] for idx in range(len(combined)) if combined[idx][1] == 1)
    r2 = sum(ranks[idx] for idx in range(len(combined)) if combined[idx][1] == 2)

    u1 = n1 * n2 + (n1 * (n1 + 1)) / 2.0 - r1
    u2 = n1 * n2 - u1
    u = min(u1, u2)

    mean_u = (n1 * n2) / 2.0
    std_u = math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12.0)

    # Continuity correction
    z = (u - mean_u + 0.5) / std_u if std_u > 0 else 0.0

    # Two-tailed p-value approximation via standard normal error function
    p_value = 2.0 * (1.0 - 0.5 * (1.0 + math.erf(abs(z) / math.sqrt(2.0))))

    return {
        'u_stat': round(float(u), 2),
        'u1': round(float(u1), 2),
        'u2': round(float(u2), 2),
        'z_score': round(float(z), 3),
        'p_value': round(float(p_value), 4),
        'significant': p_value < 0.05
    }

def sensitivity_check(daily_series_by_year: Dict[int, List[float]], thresholds: List[float] = [15.0, 20.0, 25.0]) -> Dict[str, Any]:
    """
    Evaluates onset stability when threshold is perturbed by +/- 5mm.
    """
    results = {}
    for th in thresholds:
        period1_onsets = []
        period2_onsets = []
        for year, daily_mm in daily_series_by_year.items():
            onset = rain_onset(daily_mm, window=7, threshold_mm=th, dry_spell_max=7)
            if onset is not None:
                if 2001 <= year <= 2012:
                    period1_onsets.append(onset)
                elif 2013 <= year <= 2025:
                    period2_onsets.append(onset)
                    
        p1_mean = sum(period1_onsets) / len(period1_onsets) if period1_onsets else 0
        p2_mean = sum(period2_onsets) / len(period2_onsets) if period2_onsets else 0
        shift = round(p2_mean - p1_mean, 1)
        results[f"{int(th)}mm"] = {
            'threshold_mm': th,
            'period1_mean_doy': round(p1_mean, 1),
            'period2_mean_doy': round(p2_mean, 1),
            'shift_days': shift,
            'whole_days_shift': int(round(shift))
        }
    return results

if __name__ == '__main__':
    print("Field Shift - Agronomic Compute Engine Initialized.")
