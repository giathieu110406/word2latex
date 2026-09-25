// Bộ dữ liệu mẫu chuẩn 7 ngày gần nhất được nạp sẵn để hiển thị ngay tức thì
// và tự động đồng bộ lên Firebase Cloud Firestore khi Admin truy cập Dashboard

export interface SeedDayStats {
  id: string;
  date: string;
  timestamp: string;
  requests: number;
  totalDurationMinutes: number;
  hourly: Record<string, { requests: number; durationMinutes: number }>;
  featureDurations: Record<string, number>;
  [key: string]: any;
}

export const DEFAULT_SEED_STATS: Record<string, SeedDayStats> = {
  "2026-09-18": {
    "timestamp": "2026-09-18T16:40:23.646Z",
    "date": "2026-09-18",
    "requests": 81,
    "totalDurationMinutes": 277,
    "hourly": {
      "10": {
        "requests": 9,
        "durationMinutes": 36
      },
      "11": {
        "requests": 5,
        "durationMinutes": 20
      },
      "12": {
        "requests": 1,
        "durationMinutes": 3
      },
      "13": {
        "requests": 3,
        "durationMinutes": 6
      },
      "14": {
        "requests": 8,
        "durationMinutes": 32
      },
      "15": {
        "requests": 3,
        "durationMinutes": 6
      },
      "16": {
        "requests": 5,
        "durationMinutes": 10
      },
      "17": {
        "requests": 8,
        "durationMinutes": 24
      },
      "18": {
        "requests": 2,
        "durationMinutes": 8
      },
      "19": {
        "requests": 2,
        "durationMinutes": 6
      },
      "20": {
        "requests": 5,
        "durationMinutes": 20
      },
      "21": {
        "requests": 5,
        "durationMinutes": 15
      },
      "22": {
        "requests": 8,
        "durationMinutes": 32
      },
      "23": {
        "requests": 7,
        "durationMinutes": 28
      },
      "00": {
        "requests": 0,
        "durationMinutes": 0
      },
      "01": {
        "requests": 0,
        "durationMinutes": 0
      },
      "02": {
        "requests": 1,
        "durationMinutes": 3
      },
      "03": {
        "requests": 0,
        "durationMinutes": 0
      },
      "04": {
        "requests": 0,
        "durationMinutes": 0
      },
      "05": {
        "requests": 0,
        "durationMinutes": 0
      },
      "06": {
        "requests": 1,
        "durationMinutes": 4
      },
      "07": {
        "requests": 0,
        "durationMinutes": 0
      },
      "08": {
        "requests": 5,
        "durationMinutes": 15
      },
      "09": {
        "requests": 3,
        "durationMinutes": 9
      }
    },
    "featureDurations": {
      "Chuyển đổi LaTeX": 124,
      "Soạn đề thi (AI)": 77,
      "MarkItDown AI": 47,
      "AI Canvas": 16,
      "Dán AI": 11
    },
    "Chuyển đổi LaTeX": 36,
    "Soạn đề thi (AI)": 22,
    "MarkItDown AI": 13,
    "AI Canvas": 6,
    "Dán AI": 4,
    "id": "2026-09-18"
  },
  "2026-09-19": {
    "timestamp": "2026-09-19T16:40:23.646Z",
    "date": "2026-09-19",
    "requests": 78,
    "totalDurationMinutes": 235,
    "hourly": {
      "10": {
        "requests": 8,
        "durationMinutes": 32
      },
      "11": {
        "requests": 4,
        "durationMinutes": 16
      },
      "12": {
        "requests": 0,
        "durationMinutes": 0
      },
      "13": {
        "requests": 0,
        "durationMinutes": 0
      },
      "14": {
        "requests": 3,
        "durationMinutes": 9
      },
      "15": {
        "requests": 4,
        "durationMinutes": 12
      },
      "16": {
        "requests": 5,
        "durationMinutes": 10
      },
      "17": {
        "requests": 4,
        "durationMinutes": 12
      },
      "18": {
        "requests": 1,
        "durationMinutes": 3
      },
      "19": {
        "requests": 1,
        "durationMinutes": 2
      },
      "20": {
        "requests": 9,
        "durationMinutes": 18
      },
      "21": {
        "requests": 8,
        "durationMinutes": 24
      },
      "22": {
        "requests": 8,
        "durationMinutes": 16
      },
      "23": {
        "requests": 7,
        "durationMinutes": 21
      },
      "00": {
        "requests": 1,
        "durationMinutes": 4
      },
      "01": {
        "requests": 1,
        "durationMinutes": 4
      },
      "02": {
        "requests": 1,
        "durationMinutes": 4
      },
      "03": {
        "requests": 0,
        "durationMinutes": 0
      },
      "04": {
        "requests": 0,
        "durationMinutes": 0
      },
      "05": {
        "requests": 0,
        "durationMinutes": 0
      },
      "06": {
        "requests": 1,
        "durationMinutes": 2
      },
      "07": {
        "requests": 1,
        "durationMinutes": 2
      },
      "08": {
        "requests": 5,
        "durationMinutes": 20
      },
      "09": {
        "requests": 6,
        "durationMinutes": 24
      }
    },
    "featureDurations": {
      "Chuyển đổi LaTeX": 105,
      "Soạn đề thi (AI)": 65,
      "MarkItDown AI": 39,
      "AI Canvas": 14,
      "Dán AI": 9
    },
    "Chuyển đổi LaTeX": 35,
    "Soạn đề thi (AI)": 21,
    "MarkItDown AI": 13,
    "AI Canvas": 5,
    "Dán AI": 4,
    "id": "2026-09-19"
  },
  "2026-09-20": {
    "timestamp": "2026-09-20T16:40:23.646Z",
    "date": "2026-09-20",
    "requests": 91,
    "totalDurationMinutes": 264,
    "hourly": {
      "10": {
        "requests": 6,
        "durationMinutes": 24
      },
      "11": {
        "requests": 10,
        "durationMinutes": 30
      },
      "12": {
        "requests": 1,
        "durationMinutes": 4
      },
      "13": {
        "requests": 3,
        "durationMinutes": 6
      },
      "14": {
        "requests": 7,
        "durationMinutes": 21
      },
      "15": {
        "requests": 9,
        "durationMinutes": 36
      },
      "16": {
        "requests": 6,
        "durationMinutes": 12
      },
      "17": {
        "requests": 6,
        "durationMinutes": 12
      },
      "18": {
        "requests": 2,
        "durationMinutes": 4
      },
      "19": {
        "requests": 1,
        "durationMinutes": 3
      },
      "20": {
        "requests": 7,
        "durationMinutes": 28
      },
      "21": {
        "requests": 5,
        "durationMinutes": 10
      },
      "22": {
        "requests": 6,
        "durationMinutes": 18
      },
      "23": {
        "requests": 7,
        "durationMinutes": 14
      },
      "00": {
        "requests": 1,
        "durationMinutes": 2
      },
      "01": {
        "requests": 0,
        "durationMinutes": 0
      },
      "02": {
        "requests": 1,
        "durationMinutes": 3
      },
      "03": {
        "requests": 0,
        "durationMinutes": 0
      },
      "04": {
        "requests": 0,
        "durationMinutes": 0
      },
      "05": {
        "requests": 0,
        "durationMinutes": 0
      },
      "06": {
        "requests": 1,
        "durationMinutes": 3
      },
      "07": {
        "requests": 3,
        "durationMinutes": 6
      },
      "08": {
        "requests": 5,
        "durationMinutes": 20
      },
      "09": {
        "requests": 4,
        "durationMinutes": 8
      }
    },
    "featureDurations": {
      "Chuyển đổi LaTeX": 118,
      "Soạn đề thi (AI)": 73,
      "MarkItDown AI": 44,
      "AI Canvas": 15,
      "Dán AI": 10
    },
    "Chuyển đổi LaTeX": 40,
    "Soạn đề thi (AI)": 25,
    "MarkItDown AI": 15,
    "AI Canvas": 6,
    "Dán AI": 5,
    "id": "2026-09-20"
  },
  "2026-09-21": {
    "timestamp": "2026-09-21T16:40:23.646Z",
    "date": "2026-09-21",
    "requests": 102,
    "totalDurationMinutes": 310,
    "hourly": {
      "10": {
        "requests": 10,
        "durationMinutes": 40
      },
      "11": {
        "requests": 9,
        "durationMinutes": 18
      },
      "12": {
        "requests": 2,
        "durationMinutes": 4
      },
      "13": {
        "requests": 2,
        "durationMinutes": 6
      },
      "14": {
        "requests": 10,
        "durationMinutes": 30
      },
      "15": {
        "requests": 6,
        "durationMinutes": 12
      },
      "16": {
        "requests": 3,
        "durationMinutes": 12
      },
      "17": {
        "requests": 7,
        "durationMinutes": 21
      },
      "18": {
        "requests": 0,
        "durationMinutes": 0
      },
      "19": {
        "requests": 0,
        "durationMinutes": 0
      },
      "20": {
        "requests": 8,
        "durationMinutes": 24
      },
      "21": {
        "requests": 8,
        "durationMinutes": 16
      },
      "22": {
        "requests": 10,
        "durationMinutes": 40
      },
      "23": {
        "requests": 4,
        "durationMinutes": 16
      },
      "00": {
        "requests": 1,
        "durationMinutes": 4
      },
      "01": {
        "requests": 1,
        "durationMinutes": 4
      },
      "02": {
        "requests": 0,
        "durationMinutes": 0
      },
      "03": {
        "requests": 1,
        "durationMinutes": 2
      },
      "04": {
        "requests": 1,
        "durationMinutes": 3
      },
      "05": {
        "requests": 1,
        "durationMinutes": 4
      },
      "06": {
        "requests": 2,
        "durationMinutes": 6
      },
      "07": {
        "requests": 3,
        "durationMinutes": 9
      },
      "08": {
        "requests": 7,
        "durationMinutes": 21
      },
      "09": {
        "requests": 6,
        "durationMinutes": 18
      }
    },
    "featureDurations": {
      "Chuyển đổi LaTeX": 139,
      "Soạn đề thi (AI)": 86,
      "MarkItDown AI": 52,
      "AI Canvas": 18,
      "Dán AI": 12
    },
    "Chuyển đổi LaTeX": 45,
    "Soạn đề thi (AI)": 28,
    "MarkItDown AI": 17,
    "AI Canvas": 7,
    "Dán AI": 5,
    "id": "2026-09-21"
  },
  "2026-09-22": {
    "timestamp": "2026-09-22T16:40:23.646Z",
    "date": "2026-09-22",
    "requests": 98,
    "totalDurationMinutes": 307,
    "hourly": {
      "10": {
        "requests": 4,
        "durationMinutes": 12
      },
      "11": {
        "requests": 5,
        "durationMinutes": 20
      },
      "12": {
        "requests": 3,
        "durationMinutes": 12
      },
      "13": {
        "requests": 1,
        "durationMinutes": 4
      },
      "14": {
        "requests": 8,
        "durationMinutes": 16
      },
      "15": {
        "requests": 10,
        "durationMinutes": 40
      },
      "16": {
        "requests": 9,
        "durationMinutes": 36
      },
      "17": {
        "requests": 6,
        "durationMinutes": 18
      },
      "18": {
        "requests": 3,
        "durationMinutes": 9
      },
      "19": {
        "requests": 1,
        "durationMinutes": 4
      },
      "20": {
        "requests": 4,
        "durationMinutes": 12
      },
      "21": {
        "requests": 7,
        "durationMinutes": 14
      },
      "22": {
        "requests": 7,
        "durationMinutes": 14
      },
      "23": {
        "requests": 10,
        "durationMinutes": 40
      },
      "00": {
        "requests": 0,
        "durationMinutes": 0
      },
      "01": {
        "requests": 0,
        "durationMinutes": 0
      },
      "02": {
        "requests": 1,
        "durationMinutes": 2
      },
      "03": {
        "requests": 1,
        "durationMinutes": 3
      },
      "04": {
        "requests": 0,
        "durationMinutes": 0
      },
      "05": {
        "requests": 1,
        "durationMinutes": 4
      },
      "06": {
        "requests": 1,
        "durationMinutes": 4
      },
      "07": {
        "requests": 1,
        "durationMinutes": 3
      },
      "08": {
        "requests": 5,
        "durationMinutes": 20
      },
      "09": {
        "requests": 10,
        "durationMinutes": 20
      }
    },
    "featureDurations": {
      "Chuyển đổi LaTeX": 138,
      "Soạn đề thi (AI)": 85,
      "MarkItDown AI": 52,
      "AI Canvas": 18,
      "Dán AI": 12
    },
    "Chuyển đổi LaTeX": 44,
    "Soạn đề thi (AI)": 27,
    "MarkItDown AI": 16,
    "AI Canvas": 6,
    "Dán AI": 5,
    "id": "2026-09-22"
  },
  "2026-09-23": {
    "timestamp": "2026-09-23T16:40:23.646Z",
    "date": "2026-09-23",
    "requests": 92,
    "totalDurationMinutes": 269,
    "hourly": {
      "10": {
        "requests": 3,
        "durationMinutes": 6
      },
      "11": {
        "requests": 7,
        "durationMinutes": 28
      },
      "12": {
        "requests": 3,
        "durationMinutes": 12
      },
      "13": {
        "requests": 3,
        "durationMinutes": 9
      },
      "14": {
        "requests": 6,
        "durationMinutes": 18
      },
      "15": {
        "requests": 4,
        "durationMinutes": 8
      },
      "16": {
        "requests": 9,
        "durationMinutes": 18
      },
      "17": {
        "requests": 5,
        "durationMinutes": 20
      },
      "18": {
        "requests": 0,
        "durationMinutes": 0
      },
      "19": {
        "requests": 0,
        "durationMinutes": 0
      },
      "20": {
        "requests": 7,
        "durationMinutes": 14
      },
      "21": {
        "requests": 8,
        "durationMinutes": 32
      },
      "22": {
        "requests": 8,
        "durationMinutes": 16
      },
      "23": {
        "requests": 9,
        "durationMinutes": 36
      },
      "00": {
        "requests": 0,
        "durationMinutes": 0
      },
      "01": {
        "requests": 0,
        "durationMinutes": 0
      },
      "02": {
        "requests": 0,
        "durationMinutes": 0
      },
      "03": {
        "requests": 1,
        "durationMinutes": 3
      },
      "04": {
        "requests": 1,
        "durationMinutes": 3
      },
      "05": {
        "requests": 1,
        "durationMinutes": 2
      },
      "06": {
        "requests": 3,
        "durationMinutes": 9
      },
      "07": {
        "requests": 1,
        "durationMinutes": 3
      },
      "08": {
        "requests": 10,
        "durationMinutes": 20
      },
      "09": {
        "requests": 3,
        "durationMinutes": 12
      }
    },
    "featureDurations": {
      "Chuyển đổi LaTeX": 121,
      "Soạn đề thi (AI)": 75,
      "MarkItDown AI": 45,
      "AI Canvas": 16,
      "Dán AI": 10
    },
    "Chuyển đổi LaTeX": 41,
    "Soạn đề thi (AI)": 25,
    "MarkItDown AI": 15,
    "AI Canvas": 6,
    "Dán AI": 5,
    "id": "2026-09-23"
  },
  "2026-09-24": {
    "timestamp": "2026-09-24T16:51:08.352Z",
    "date": "2026-09-24",
    "requests": 89,
    "totalDurationMinutes": 288,
    "hourly": {
      "10": {
        "requests": 9,
        "durationMinutes": 18
      },
      "11": {
        "requests": 4,
        "durationMinutes": 8
      },
      "12": {
        "requests": 3,
        "durationMinutes": 12
      },
      "13": {
        "requests": 0,
        "durationMinutes": 0
      },
      "14": {
        "requests": 7,
        "durationMinutes": 28
      },
      "15": {
        "requests": 3,
        "durationMinutes": 6
      },
      "16": {
        "requests": 6,
        "durationMinutes": 12
      },
      "17": {
        "requests": 10,
        "durationMinutes": 40
      },
      "18": {
        "requests": 2,
        "durationMinutes": 6
      },
      "19": {
        "requests": 1,
        "durationMinutes": 3
      },
      "20": {
        "requests": 8,
        "durationMinutes": 32
      },
      "21": {
        "requests": 6,
        "durationMinutes": 24
      },
      "22": {
        "requests": 5,
        "durationMinutes": 10
      },
      "23": {
        "requests": 9,
        "durationMinutes": 31
      },
      "00": {
        "requests": 1,
        "durationMinutes": 3
      },
      "01": {
        "requests": 0,
        "durationMinutes": 0
      },
      "02": {
        "requests": 0,
        "durationMinutes": 0
      },
      "03": {
        "requests": 0,
        "durationMinutes": 0
      },
      "04": {
        "requests": 0,
        "durationMinutes": 0
      },
      "05": {
        "requests": 0,
        "durationMinutes": 0
      },
      "06": {
        "requests": 0,
        "durationMinutes": 0
      },
      "07": {
        "requests": 2,
        "durationMinutes": 8
      },
      "08": {
        "requests": 5,
        "durationMinutes": 15
      },
      "09": {
        "requests": 8,
        "durationMinutes": 32
      }
    },
    "featureDurations": {
      "Chuyển đổi LaTeX": 132,
      "Soạn đề thi (AI)": 78,
      "MarkItDown AI": 47,
      "AI Canvas": 16,
      "Dán AI": 11,
      "Tổng quan": 1,
      "Phân tích sử dụng": 1
    },
    "Chuyển đổi LaTeX": 39,
    "Soạn đề thi (AI)": 24,
    "MarkItDown AI": 14,
    "AI Canvas": 6,
    "Dán AI": 4,
    "Tổng quan": 1,
    "Phân tích sử dụng": 1,
    "id": "2026-09-24"
  },
  "2026-09-25": {
    "timestamp": "2026-09-24T23:12:51.752Z",
    "date": "2026-09-25",
    "requests": 2,
    "totalDurationMinutes": 2,
    "hourly": {
      "10": {
        "requests": 0,
        "durationMinutes": 0
      },
      "11": {
        "requests": 0,
        "durationMinutes": 0
      },
      "12": {
        "requests": 0,
        "durationMinutes": 0
      },
      "13": {
        "requests": 0,
        "durationMinutes": 0
      },
      "14": {
        "requests": 0,
        "durationMinutes": 0
      },
      "15": {
        "requests": 0,
        "durationMinutes": 0
      },
      "16": {
        "requests": 0,
        "durationMinutes": 0
      },
      "17": {
        "requests": 0,
        "durationMinutes": 0
      },
      "18": {
        "requests": 0,
        "durationMinutes": 0
      },
      "19": {
        "requests": 0,
        "durationMinutes": 0
      },
      "20": {
        "requests": 0,
        "durationMinutes": 0
      },
      "21": {
        "requests": 0,
        "durationMinutes": 0
      },
      "22": {
        "requests": 0,
        "durationMinutes": 0
      },
      "23": {
        "requests": 0,
        "durationMinutes": 0
      },
      "00": {
        "requests": 1,
        "durationMinutes": 1
      },
      "01": {
        "requests": 0,
        "durationMinutes": 0
      },
      "02": {
        "requests": 0,
        "durationMinutes": 0
      },
      "03": {
        "requests": 0,
        "durationMinutes": 0
      },
      "04": {
        "requests": 0,
        "durationMinutes": 0
      },
      "05": {
        "requests": 0,
        "durationMinutes": 0
      },
      "06": {
        "requests": 1,
        "durationMinutes": 1
      },
      "07": {
        "requests": 0,
        "durationMinutes": 0
      },
      "08": {
        "requests": 0,
        "durationMinutes": 0
      },
      "09": {
        "requests": 0,
        "durationMinutes": 0
      }
    },
    "featureDurations": {
      "Chuyển đổi LaTeX": 0,
      "Soạn đề thi (AI)": 0,
      "MarkItDown AI": 0,
      "AI canvas": 2,
      "AI hỏi đáp": 0,
      "Dán AI": 0,
      "AI thay thế số liệu": 0,
      "Trích xuất văn bản": 0
    },
    "Chuyển đổi LaTeX": 0,
    "Soạn đề thi (AI)": 0,
    "MarkItDown AI": 0,
    "AI canvas": 2,
    "AI hỏi đáp": 0,
    "Dán AI": 0,
    "AI thay thế số liệu": 0,
    "Trích xuất văn bản": 0,
    "id": "2026-09-25"
  }
};
