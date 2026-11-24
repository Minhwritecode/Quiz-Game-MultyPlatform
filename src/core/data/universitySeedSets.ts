import type { QuestionSet } from '@/core/domain/models';

const SEED_UPDATED_AT = '2026-11-24T00:00:00.000Z';

function makeSet(
  id: string,
  title: string,
  subject: string,
  tags: string[],
  items: Array<[string, [string, string, string, string], number, string]>
): QuestionSet {
  return {
    id,
    title,
    subject,
    tags,
    updatedAt: SEED_UPDATED_AT,
    syncStatus: 'synced',
    questions: items.map(([content, options, correctIndex, explanation], idx) => ({
      id: `${id}-q-${idx + 1}`,
      content,
      options,
      correctIndex,
      explanation,
      position: idx,
    })),
  };
}

/**
 * 16 University-level academic question sets (combined with 4 core sets in seed.ts = 20 total).
 * Covers IT/Software Engineering, World & Vietnamese History, Biology, Physics, Chemistry,
 * and Vietnamese & World Literature (Medieval, Early Modern, Modern).
 */
export const universitySeedSets: QuestionSet[] = [
  makeSet(
    'univ-it-dsa',
    'Cấu trúc Dữ liệu & Giải thuật (Đại học)',
    'Công nghệ thông tin · DSA',
    ['IT', 'DSA', 'Đại học'],
    [
      [
        'Độ phức tạp thời gian trường hợp xấu nhất của QuickSort khi chọn phần tử chốt (pivot) không tối ưu là bao nhiêu?',
        ['O(n²)', 'O(n log n)', 'O(log n)', 'O(n)'],
        0,
        'Khi mảng đã sắp xếp và chọn pivot ở đầu/cuối, phân hoạch lệch hoàn toàn khiến QuickSort mất O(n²).',
      ],
      [
        'Cấu trúc dữ liệu nào đảm bảo chiều cao luôn ở mức O(log n) thông qua các phép quay (rotation) sau khi chèn hoặc xóa?',
        ['Cây nhị phân tìm kiếm thường (BST)', 'Cây AVL / Red-Black Tree', 'Danh sách liên kết đôi', 'Bảng băm chuỗi mở'],
        1,
        'Cây AVL và Red-Black Tree là cây tìm kiếm nhị phân tự cân bằng, giữ chiều cao O(log n).',
      ],
      [
        'Thuật toán nào thích hợp nhất để tìm cây khung nhỏ nhất (Minimum Spanning Tree) trên đồ thị thưa bằng cấu trúc Disjoint Set Union (DSU)?',
        ['Kruskal', 'Bellman-Ford', 'Floyd-Warshall', 'Topological Sort'],
        0,
        'Kruskal sắp xếp cạnh theo trọng số tăng dần và dùng DSU để kiểm tra chu trình với độ phức tạp O(E log E).',
      ],
      [
        'Trong quy hoạch động (Dynamic Programming), hai tính chất cốt lõi bắt buộc phải có của bài toán là gì?',
        [
          'Cấu trúc con tối ưu và bài toán con gối nhau',
          'Đồ thị có chu trình âm và không liên thông',
          'Dữ liệu đầu vào phải được sắp xếp tăng dần',
          'Bắt buộc sử dụng đệ quy đuôi',
        ],
        0,
        'Optimal Substructure và Overlapping Subproblems là hai điều kiện đặc trưng để áp dụng Quy hoạch động.',
      ],
      [
        'Trong Bảng băm (Hash Table), phương pháp nào xử lý xung đột bằng cách lưu danh sách các phần tử có cùng mã băm tại mỗi ô?',
        ['Separate Chaining', 'Linear Probing', 'Quadratic Probing', 'Double Hashing'],
        0,
        'Separate Chaining gắn một linked list hoặc bucket động vào mỗi slot của bảng băm.',
      ],
      [
        'Thuật toán duyệt đồ thị theo chiều rộng (BFS) sử dụng cấu trúc dữ liệu phụ trợ nào và tìm được đường đi ngắn nhất trên loại đồ thị nào?',
        [
          'Queue — đồ thị không trọng số',
          'Stack — đồ thị có trọng số âm',
          'Priority Queue — mọi đồ thị có chu trình âm',
          'Trie — đồ thị đầy đủ',
        ],
        0,
        'BFS dùng hàng đợi (Queue) duyệt từng lớp khoảng cách, đảm bảo đường đi ít cạnh nhất trên đồ thị không trọng số.',
      ],
      [
        'Hàng đợi ưu tiên (Priority Queue) cài đặt bằng Binary Heap thực hiện thao tác lấy phần tử lớn nhất (extract-max) trong thời gian nào?',
        ['O(log n)', 'O(1)', 'O(n)', 'O(n log n)'],
        0,
        'Sau khi đưa phần tử cuối lên gốc, thao tác heapify-down đi dọc chiều cao cây nên tốn O(log n).',
      ],
      [
        'Định lý Thợ (Master Theorem) dùng để giải quyết dạng bài toán nào trong phân tích giải thuật?',
        [
          'Ước lượng độ phức tạp của hệ thức truy hồi chia để trị T(n) = aT(n/b) + f(n)',
          'Chứng minh bài toán thuộc lớp NP-Complete',
          'Tối ưu hóa bộ nhớ đệm CPU L1/L2',
          'Tính toán hệ số nén Huffman',
        ],
        0,
        'Master Theorem cung cấp nghiệm tiệm cận nhanh cho các hệ thức truy hồi chia để trị chuẩn.',
      ],
    ]
  ),

  makeSet(
    'univ-it-os',
    'Hệ điều hành (Operating Systems)',
    'Công nghệ thông tin · OS',
    ['IT', 'Hệ điều hành', 'Đại học'],
    [
      [
        'Trong 4 điều kiện Coffman dẫn đến Deadlock (tắc nghẽn), điều kiện nào nói rằng một tiến trình giữ ít nhất một tài nguyên trong khi chờ tài nguyên khác?',
        ['Hold and Wait (Giữ và chờ)', 'Mutual Exclusion', 'No Preemption', 'Circular Wait'],
        0,
        'Bốn điều kiện Coffman gồm: Mutual Exclusion, Hold and Wait, No Preemption và Circular Wait.',
      ],
      [
        'Thuật toán lập lịch CPU nào có thời gian chờ trung bình tối ưu nhất (nhỏ nhất) trong số các thuật toán không độc quyền nếu biết trước burst time?',
        ['Shortest Job First (SJF)', 'First-Come First-Served (FCFS)', 'Round Robin', 'Multilevel Queue'],
        0,
        'SJF (hoặc SRTF phiên bản có trưng dụng) chứng minh được thời gian chờ trung bình nhỏ nhất.',
      ],
      [
        'Hiện tượng Thrashing trong quản lý bộ nhớ ảo xảy ra khi nào?',
        [
          'Hệ thống tốn phần lớn thời gian hoán trang (page fault) thay vì thực thi lệnh tiến trình',
          'CPU đạt 100% do tính toán dấu phẩy động',
          'Ổ cứng SSD bị phân mảnh vật lý nặng',
          'Tiến trình không gọi lệnh free() sau malloc()',
        ],
        0,
        'Khi tổng working set vượt quá số khung trang vật lý, hệ điều hành liên tục swap trang ra/vào đĩa gây sụt hiệu năng nghiêm trọng.',
      ],
      [
        'Thành phần phần cứng nào lưu bộ đệm ánh xạ nhanh giữa địa chỉ ảo (Virtual Page) và khung trang vật lý (Physical Frame)?',
        ['TLB (Translation Lookaside Buffer)', 'ALU', 'DMA Controller', 'Northbridge'],
        0,
        'TLB là cache tốc độ cao nằm trong MMU giúp giảm số lần truy cập bảng trang trong RAM.',
      ],
      [
        'Sự khác biệt cơ bản giữa Process (tiến trình) và Thread (luồng) trong cùng một tiến trình là gì?',
        [
          'Các Thread dùng chung không gian địa chỉ bộ nhớ (Heap, Code) nhưng có Stack và thanh ghi riêng',
          'Các Process dùng chung toàn bộ Stack và thanh ghi CPU',
          'Thread tốn nhiều chi phí chuyển ngữ cảnh hơn Process',
          'Thread không thể chạy song song trên CPU đa nhân',
        ],
        0,
        'Luồng chia sẻ code, data, heap và file descriptors của tiến trình cha, chỉ tách riêng stack và program counter.',
      ],
      [
        'Trong bài toán đồng bộ hóa, Semaphore đếm (Counting Semaphore) thực hiện hai thao tác nguyên tử nào?',
        ['wait (P) và signal (V)', 'fork và exec', 'push và pop', 'read và write'],
        0,
        'Dijkstra định nghĩa hai phép toán nguyên tử P (proberen/wait) giảm giá trị và V (verhogen/signal) tăng giá trị semaphore.',
      ],
      [
        'Thuật toán thay thế trang nào có thể gặp nghịch lý Bélády (tăng số khung trang nhưng số lỗi trang lại tăng)?',
        ['FIFO (First-In First-Out)', 'LRU (Least Recently Used)', 'Optimal (OPT)', 'Clock / Second-Chance biến thể ngăn xếp'],
        0,
        'FIFO không thuộc lớp thuật toán ngăn xếp (stack algorithm) nên có thể gặp Bélády anomaly.',
      ],
      [
        'Cơ chế System Call thực hiện chuyển đổi chế độ hoạt động của CPU như thế nào?',
        [
          'Từ User Mode sang Kernel Mode thông qua ngắt phần mềm (trap/syscall)',
          'Từ Kernel Mode sang Real Mode',
          'Chạy trực tiếp trong User Mode không cần hệ điều hành',
          'Tắt toàn bộ ngắt phần cứng vĩnh viễn',
        ],
        0,
        'System call dùng lệnh trap/syscall chuyển CPU sang đặc quyền Kernel Mode để thực hiện tác vụ I/O, tạo tiến trình an toàn.',
      ],
    ]
  ),

  makeSet(
    'univ-it-networks',
    'Mạng Máy tính & Giao thức Internet',
    'Công nghệ thông tin · Networks',
    ['IT', 'Mạng máy tính', 'TCP/IP'],
    [
      [
        'Trong mô hình OSI 7 tầng, giao thức TCP và UDP hoạt động ở tầng nào?',
        ['Tầng 4 — Transport (Giao vận)', 'Tầng 3 — Network (Mạng)', 'Tầng 5 — Session', 'Tầng 2 — Data Link'],
        0,
        'Tầng Transport chịu trách nhiệm truyền dữ liệu đầu cuối (end-to-end) giữa các tiến trình thông qua cổng (port).',
      ],
      [
        'Quá trình thiết lập kết nối TCP bắt tay 3 bước (3-Way Handshake) diễn ra theo đúng thứ tự cờ nào?',
        ['SYN → SYN-ACK → ACK', 'ACK → SYN → FIN', 'SYN → ACK → FIN', 'HELLO → AUTH → OK'],
        0,
        'Client gửi SYN, Server phản hồi SYN-ACK, và Client xác nhận ACK để đồng bộ số thứ tự (sequence number).',
      ],
      [
        'Giao thức HTTP/3 mang lại bước nhảy vọt về độ trễ bằng cách chạy trên nền giao thức truyền tải nào?',
        ['QUIC (dựa trên UDP)', 'TCP với Nagle algorithm', 'ICMP', 'SCTP cổ điển'],
        0,
        'QUIC tích hợp TLS 1.3 trên UDP, loại bỏ lỗi Head-of-Line blocking ở tầng giao vận và hỗ trợ 0-RTT.',
      ],
      [
        'Một mạng con IPv4 có mặt nạ CIDR là /26 cung cấp tối đa bao nhiêu địa chỉ IP khả dụng cho host?',
        ['62 host', '64 host', '30 host', '126 host'],
        0,
        'Còn 32 - 26 = 6 bit host → 2^6 - 2 = 62 địa chỉ host khả dụng (trừ địa chỉ mạng và broadcast).',
      ],
      [
        'Giao thức định tuyến liên miền (EGP) nào vận hành xương sống định tuyến giữa các Hệ thống tự trị (AS) trên toàn cầu?',
        ['BGP (Border Gateway Protocol)', 'OSPF', 'RIP v2', 'ARP'],
        0,
        'BGP là giao thức path-vector định tuyến giữa các Autonomous Systems trên Internet.',
      ],
      [
        'Trong cơ chế kiểm soát tắc nghẽn TCP (Congestion Control), giai đoạn Slow Start tăng cửa sổ tắc nghẽn (cwnd) theo quy luật nào?',
        ['Tăng theo hàm mũ (gấp đôi mỗi RTT)', 'Tăng tuyến tính +1 MSS mỗi RTT', 'Giảm một nửa mỗi RTT', 'Giữ nguyên không đổi'],
        0,
        'Trong Slow Start, mỗi ACK nhận được làm tăng cwnd thêm 1 MSS, tương đương nhân đôi sau mỗi chu kỳ RTT cho đến khi chạm ssthresh.',
      ],
      [
        'Bản ghi DNS loại nào dùng để ánh xạ tên miền sang địa chỉ IPv6 (128-bit)?',
        ['AAAA', 'A', 'CNAME', 'MX'],
        0,
        'Bản ghi A ánh xạ IPv4 (32-bit), còn AAAA ánh xạ IPv6 (128-bit).',
      ],
      [
        'Trong TLS 1.3, vai trò của chứng chỉ số X.509 do CA cấp là gì?',
        [
          'Xác thực danh tính máy chủ và phân phối khóa công khai đáng tin cậy',
          'Nén dữ liệu JSON nhỏ đi 90%',
          'Thay thế hoàn toàn địa chỉ IP bằng tên miền',
          'Tăng băng thông vật lý của cáp quang',
        ],
        0,
        'Chứng chỉ số X.509 ngăn tấn công Man-in-the-Middle bằng chữ ký số của tổ chức chứng thực (CA).',
      ],
    ]
  ),

  makeSet(
    'univ-it-dbms',
    'Hệ quản trị Cơ sở dữ liệu (DBMS)',
    'Công nghệ thông tin · Database',
    ['IT', 'SQL', 'Database'],
    [
      [
        'Trong tính chất ACID của giao dịch (Transaction), chữ "I" (Isolation) đảm bảo điều gì?',
        [
          'Các giao dịch chạy đồng thời không nhìn thấy trạng thái trung gian chưa nhất quán của nhau',
          'Dữ liệu không bao giờ bị mất sau khi mất điện',
          'Mọi câu lệnh đều thực thi dưới 1 mili-giây',
          'Chỉ một người dùng được đăng nhập hệ thống tại một thời điểm',
        ],
        0,
        'Isolation cách ly hiệu ứng của các giao dịch đồng thời để tránh Dirty Read, Non-repeatable Read và Phantom Read.',
      ],
      [
        'Dạng chuẩn thứ 3 (3NF) yêu cầu bảng đã đạt 2NF và không tồn tại loại phụ thuộc nào?',
        ['Phụ thuộc bắc cầu (Transitive dependency) của thuộc tính không khóa vào khóa chính', 'Khóa ngoại tham chiếu bảng khác', 'Thuộc tính cho phép NULL', 'Chỉ mục B-Tree trên cột văn bản'],
        0,
        'Trong 3NF, mọi thuộc tính không khóa chỉ được phụ thuộc trực tiếp vào khóa dự tuyển (candidate key).',
      ],
      [
        'Vì sao cấu trúc B+ Tree được ưa chuộng làm chỉ mục (Index) mặc định trong PostgreSQL/MySQL thay vì Hash Index?',
        [
          'Hỗ trợ tốt cả truy vấn bằng (=) lẫn truy vấn khoảng (BETWEEN, >, <, ORDER BY) nhờ các nút lá liên kết nhau',
          'Không tốn dung lượng đĩa cứng',
          'Chỉ hỗ trợ khóa chính kiểu chuỗi',
          'Không cần cân bằng cây khi chèn dữ liệu',
        ],
        0,
        'Các nút lá của B+ Tree chứa toàn bộ con trỏ dữ liệu theo thứ tự tăng dần và nối thành danh sách liên kết, cực nhanh cho range scan.',
      ],
      [
        'Cơ chế MVCC (Multi-Version Concurrency Control) trong PostgreSQL mang lại lợi ích cốt lõi nào?',
        [
          'Thao tác đọc (SELECT) không chặn thao tác ghi (UPDATE) và ngược lại nhờ lưu nhiều phiên bản dòng',
          'Tự động sao chép bảng sang NoSQL',
          'Xóa toàn bộ log WAL ngay sau khi đọc',
          'Loại bỏ nhu cầu dùng khóa chính',
        ],
        0,
        'MVCC giúp mỗi giao dịch nhìn thấy một snapshot nhất quán của dữ liệu mà không phải khóa đọc/ghi lẫn nhau.',
      ],
      [
        'Hiện tượng "Phantom Read" (Đọc bóng ma) trong SQL là gì?',
        [
          'Cùng một truy vấn điều kiện WHERE chạy lại trong một giao dịch nhưng xuất hiện thêm hoặc mất đi các dòng mới được commit',
          'Đọc phải dữ liệu chưa commit của giao dịch khác',
          'Đọc bảng đã bị DROP',
          'Lỗi cú pháp khi JOIN hai bảng',
        ],
        0,
        'Phantom Read xảy ra khi giao dịch khác INSERT/DELETE các dòng thỏa mệnh đề WHERE giữa hai lần đọc.',
      ],
      [
        'Mục đích của WAL (Write-Ahead Logging) trong các RDBMS hiện đại là gì?',
        [
          'Ghi nhật ký thay đổi ra bộ nhớ bền vững trước khi cập nhật trang dữ liệu để đảm bảo Durability và khôi phục sau sự cố',
          'Lưu lịch sử truy vấn của người dùng cho mục đích quảng cáo',
          'Nén ảnh lưu trong cột BLOB',
          'Tăng số kết nối TCP đồng thời',
        ],
        0,
        'WAL bảo đảm tính nguyên tử (Atomicity) và bền vững (Durability) với chi phí ghi tuần tự rất nhanh.',
      ],
      [
        'Trong SQL, sự khác biệt giữa mệnh đề WHERE và HAVING là gì?',
        [
          'WHERE lọc từng dòng trước khi gom nhóm (GROUP BY), còn HAVING lọc các nhóm sau khi tính hàm tổng hợp',
          'HAVING luôn chạy nhanh hơn WHERE 10 lần',
          'WHERE chỉ dùng với DELETE, còn HAVING chỉ dùng với UPDATE',
          'Hai mệnh đề hoàn toàn giống nhau',
        ],
        0,
        'WHERE áp dụng trên bản ghi thô; HAVING áp dụng trên kết quả tổng hợp như COUNT(), SUM(), AVG().',
      ],
      [
        'Khái niệm "Covering Index" (Index bao phủ) giúp tối ưu truy vấn SELECT như thế nào?',
        [
          'Toàn bộ cột cần trả về đều có sẵn trong Index nên engine chỉ cần Index-Only Scan mà không phải đọc bảng gốc',
          'Tự động mã hóa toàn bộ bảng',
          'Xóa tự động các dòng trùng lặp',
          'Tăng giới hạn số cột lên 10.000',
        ],
        0,
        'Index-Only Scan bỏ qua thao tác truy cập ngẫu nhiên vào heap table, giảm mạnh I/O đĩa.',
      ],
    ]
  ),

  makeSet(
    'univ-it-cloud-devops',
    'Cloud Computing, Docker & Hệ phân tán',
    'Kỹ thuật Phần mềm · DevOps',
    ['DevOps', 'Docker', 'Cloud'],
    [
      [
        'Docker Container nhẹ hơn Máy ảo (Virtual Machine) truyền thống chủ yếu vì lý do nào?',
        [
          'Container chia sẻ nhân (Kernel) của hệ điều hành host thay vì chạy một Guest OS hoàn chỉnh',
          'Container không sử dụng RAM của máy chủ',
          'Container chỉ chạy được ngôn ngữ Python',
          'Container không có hệ thống tệp riêng',
        ],
        0,
        'Container dùng Linux namespaces & cgroups để cô lập tiến trình ngay trên Host Kernel, khởi động trong vài trăm mili-giây.',
      ],
      [
        'Trong Kubernetes, đơn vị triển khai nhỏ nhất chứa một hoặc nhiều container chia sẻ mạng và lưu trữ gọi là gì?',
        ['Pod', 'Node', 'Ingress', 'ConfigMap'],
        0,
        'Pod là đơn vị nguyên tử nhỏ nhất mà Kubernetes lập lịch và quản lý.',
      ],
      [
        'Mẫu thiết kế Circuit Breaker (Cầu dao ngắt mạch) trong kiến trúc Microservices có tác dụng gì?',
        [
          'Ngăn lỗi dây chuyền (cascading failure) bằng cách tạm ngừng gọi một service đang gặp sự cố và trả fallback nhanh',
          'Mã hóa dữ liệu truyền giữa hai microservice',
          'Tự động chia nhỏ cơ sở dữ liệu theo chiều ngang',
          'Biên dịch mã nguồn TypeScript sang WebAssembly',
        ],
        0,
        'Circuit Breaker chuyển qua trạng thái Open khi tỷ lệ lỗi vượt ngưỡng, giúp hệ thống phía sau có thời gian hồi phục.',
      ],
      [
        'Chiến lược triển khai Blue-Green Deployment hoạt động theo nguyên tắc nào?',
        [
          'Duy trì hai môi trường giống hệt nhau; triển khai bản mới lên Green, kiểm thử xong rồi chuyển toàn bộ lưu lượng từ Blue sang Green',
          'Tắt toàn bộ server 2 tiếng để nâng cấp cơ sở dữ liệu',
          'Chỉ cập nhật giao diện mà giữ nguyên backend cũ',
          'Triển khai mã nguồn trực tiếp không qua CI/CD',
        ],
        0,
        'Blue-Green giúp zero-downtime release và rollback gần như tức thì chỉ bằng đổi định tuyến Load Balancer.',
      ],
      [
        'Eventual Consistency (Nhất quán cuối cùng) thường được chọn trong hệ phân tán quy mô lớn để ưu tiên yếu tố nào của định lý CAP?',
        ['Availability (Tính sẵn sàng cao) và độ trễ thấp khi mạng bị phân mảnh', 'Loại bỏ hoàn toàn dung lượng lưu trữ', 'Đảm bảo đọc tuyến tính mạnh mọi lúc', 'Chạy hệ thống trên duy nhất 1 máy chủ'],
        0,
        'Hệ thống AP (như DynamoDB, Cassandra) chấp nhận trễ đồng bộ ngắn để luôn sẵn sàng phục vụ đọc/ghi.',
      ],
      [
        'Mục đích của Multi-stage Build trong Dockerfile là gì?',
        [
          'Tách giai đoạn biên dịch khỏi image chạy thực tế để tạo production image tối giản, an toàn và nhẹ hơn nhiều',
          'Chạy đồng thời 10 database trong một container',
          'Tự động tạo chứng chỉ SSL miễn phí',
          'Thay thế hoàn toàn Kubernetes',
        ],
        0,
        'Multi-stage build chỉ copy artifact đã build sang base image mỏng (như Alpine/Distroless), loại bỏ compiler và dev dependencies.',
      ],
      [
        'Trong CI/CD, sự khác biệt giữa Continuous Delivery và Continuous Deployment là gì?',
        [
          'Continuous Delivery cần một bước phê duyệt thủ công trước khi phát hành Production, còn Continuous Deployment phát hành tự động hoàn toàn',
          'Continuous Delivery không chạy unit test',
          'Continuous Deployment chỉ dùng cho ứng dụng di động iOS',
          'Hai khái niệm hoàn toàn giống nhau',
        ],
        0,
        'Continuous Deployment tự động đưa mọi thay đổi vượt qua pipeline kiểm thử thẳng lên môi trường Production.',
      ],
      [
        'Trong hệ thống hàng đợi thông điệp (như Kafka / RabbitMQ), khái niệm Dead Letter Queue (DLQ) dùng để làm gì?',
        [
          'Lưu giữ các thông điệp xử lý thất bại nhiều lần để kỹ sư kiểm tra, sửa lỗi và phát lại mà không làm tắc hàng đợi chính',
          'Xóa vĩnh viễn dữ liệu người dùng sau 30 ngày',
          'Nén log hệ thống dạng ZIP',
          'Cân bằng tải HTTP tầng 7',
        ],
        0,
        'DLQ cô lập poison messages để consumer chính tiếp tục hoạt động trơn tru.',
      ],
    ]
  ),

  makeSet(
    'univ-hist-vn-ancient',
    'Lịch sử Việt Nam Cổ – Trung đại',
    'Lịch sử Việt Nam',
    ['Lịch sử', 'Việt Nam', 'Trung đại'],
    [
      [
        'Chiến thắng Bạch Đằng năm 938 của Ngô Quyền mang ý nghĩa bước ngoặt lịch sử nào đối với dân tộc Việt Nam?',
        [
          'Chấm dứt hơn 1.000 năm Bắc thuộc, mở ra kỷ nguyên độc lập tự chủ lâu dài',
          'Mở đầu thời kỳ Trịnh – Nguyễn phân tranh',
          'Thống nhất hoàn toàn Đàng Trong và Đàng Ngoài',
          'Ban hành bộ luật Hồng Đức đầu tiên',
        ],
        0,
        'Trận Bạch Đằng năm 938 đánh tan quân Nam Hán, khẳng định nền độc lập vững chắc và mở đầu kỷ nguyên quân chủ độc lập.',
      ],
      [
        'Năm 1010, vua Lý Thái Tổ ban "Chiếu dời đô" chuyển kinh đô từ Hoa Lư về Đại La và đổi tên thành gì?',
        ['Thăng Long', 'Phú Xuân', 'Tây Đô', 'Cổ Loa'],
        0,
        'Lý Công Uẩn nhận định Đại La ở trung tâm trời đất, thế rồng cuộn hổ ngồi, đặt tên là Thăng Long (nay là Hà Nội).',
      ],
      [
        'Bộ luật thành văn tiêu biểu nhất thời Lê Sơ (thế kỷ XV), nổi bật với các điều khoản bảo vệ quyền lợi phụ nữ và ruộng đất công là:',
        ['Quốc triều hình luật (Luật Hồng Đức)', 'Hoàng Việt luật lệ (Luật Gia Long)', 'Hình thư thời Lý', 'Hình luật thời Trần'],
        0,
        'Quốc triều hình luật (Luật Hồng Đức) dưới triều Lê Thánh Tông đạt trình độ lập pháp tiến bộ bậc nhất thời phong kiến Việt Nam.',
      ],
      [
        'Trong 3 lần kháng chiến chống quân Mông – Nguyên thế kỷ XIII (1258, 1285, 1288), nhà Trần đã sử dụng kế sách chiến lược nổi tiếng nào?',
        [
          '"Vườn không nhà trống", tránh chỗ mạnh đánh chỗ yếu và phản công quyết định',
          'Cố thủ hoàn toàn trong kinh thành Thăng Long',
          'Cầu viện quân đội phương Tây',
          'Cắt đất giảng hòa ở biên giới phía Bắc',
        ],
        0,
        'Kế sách "thanh dã" (vườn không nhà trống) kết hợp chiến tranh nhân dân và thủy chiến Bạch Đằng đã đánh bại đế chế Mông – Nguyên hùng mạnh nhất thế giới lúc bấy giờ.',
      ],
      [
        'Cuộc khởi nghĩa Lam Sơn (1418–1427) do Lê Lợi lãnh đạo với mưu lược của Nguyễn Trãi đã kết thúc ách đô hộ của triều đại nào?',
        ['Nhà Minh', 'Nhà Tống', 'Nhà Thanh', 'Nhà Đường'],
        0,
        'Chiến thắng Chi Lăng – Xương Giang năm 1427 buộc Vương Thông rút quân, lập nên nhà Hậu Lê và bản tuyên ngôn Bình Ngô đại cáo.',
      ],
      [
        'Văn Miếu – Quốc Tử Giám, trường đại học đầu tiên của Việt Nam, được xây dựng dưới triều đại nào?',
        ['Nhà Lý (Văn Miếu 1070, Quốc Tử Giám 1076)', 'Nhà Trần', 'Nhà Đinh', 'Nhà Nguyễn'],
        0,
        'Vua Lý Thánh Tông lập Văn Miếu năm 1070 và vua Lý Nhân Tông lập Quốc Tử Giám năm 1076.',
      ],
      [
        'Chiến thắng Ngọc Hồi – Đống Đa mùa xuân Kỷ Dậu (1789) do Hoàng đế Quang Trung chỉ huy đã đánh tan 29 vạn quân xâm lược nào?',
        ['Quân Thanh', 'Quân Xiêm', 'Quân Minh', 'Quân Nguyên'],
        0,
        'Cuộc hành quân thần tốc của Nguyễn Huệ đã giải phóng Thăng Long chỉ trong 5 ngày Tết Kỷ Dậu 1789.',
      ],
      [
        'Quốc hiệu "Việt Nam" chính thức được sử dụng lần đầu tiên vào năm 1804 dưới triều đại nào?',
        ['Nhà Nguyễn (Vua Gia Long)', 'Nhà Tây Sơn', 'Nhà Hậu Lê', 'Nhà Hồ'],
        0,
        'Năm 1804, vua Gia Long chính thức đặt quốc hiệu là Việt Nam, khẳng định lãnh thổ thống nhất từ ải Nam Quan đến mũi Cà Mau.',
      ],
    ]
  ),

  makeSet(
    'univ-hist-vn-modern',
    'Lịch sử Việt Nam Cận – Hiện đại (1858–Nay)',
    'Lịch sử Việt Nam',
    ['Lịch sử', 'Việt Nam', 'Hiện đại'],
    [
      [
        'Thực dân Pháp nổ súng mở đầu cuộc chiến tranh xâm lược Việt Nam vào ngày 1/9/1858 tại địa điểm nào?',
        ['Bán đảo Sơn Trà (Đà Nẵng)', 'Thành Gia Định', 'Cửa biển Thuận An', 'Thành Hà Nội'],
        0,
        'Liên quân Pháp – Tây Ban Nha tấn công Đà Nẵng nhằm thực hiện kế hoạch "đánh nhanh thắng nhanh" nhưng bị quân dân ta cầm chân.',
      ],
      [
        'Hai xu hướng cứu nước tiêu biểu đầu thế kỷ XX do Phan Bội Châu và Phan Châu Trinh khởi xướng lần lượt là gì?',
        [
          'Bạo động vũ trang (Đông Du) và Cải cách duy tân (Duy Tân)',
          'Cần Vương và Khởi nghĩa nông dân Yên Thế',
          'Đấu tranh nghị trường và Hợp tác liên bang',
          'Cách mạng vô sản và Kháng chiến trường kỳ',
        ],
        0,
        'Phan Bội Châu chủ trương cầu viện Nhật Bản và bạo động giành độc lập; Phan Châu Trinh chủ trương "khai dân trí, chấn dân khí, hậu dân sinh".',
      ],
      [
        'Hội nghị hợp nhất các tổ chức cộng sản thành lập Đảng Cộng sản Việt Nam diễn ra vào đầu năm 1930 tại đâu?',
        ['Cửu Long (Hương Cảng / Hồng Kông)', 'Quảng Châu', 'Pác Bó (Cao Bằng)', 'Tân Trào (Tuyên Quang)'],
        0,
        'Nguyễn Ái Quốc chủ trì Hội nghị hợp nhất tại Cửu Long (Hồng Kông) và thông qua Chính cương vắn tắt, Sách lược vắn tắt.',
      ],
      [
        'Ngày 2/9/1945 tại Quảng trường Ba Đình (Hà Nội), Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập khai sinh ra nhà nước nào?',
        ['Nước Việt Nam Dân chủ Cộng hòa', 'Cộng hòa Xã hội Chủ nghĩa Việt Nam', 'Liên bang Đông Dương', 'Việt Nam Cộng hòa'],
        0,
        'Sự kiện ngày 2/9/1945 khai sinh nước Việt Nam Dân chủ Cộng hòa — nhà nước công nông đầu tiên ở Đông Nam Á.',
      ],
      [
        'Chiến thắng Điện Biên Phủ ngày 7/5/1954 buộc thực dân Pháp phải ký kết hiệp định quốc tế nào?',
        ['Hiệp định Genève (21/7/1954)', 'Hiệp định Sơ bộ (6/3/1946)', 'Hiệp định Paris (27/1/1973)', 'Hiệp ước Patenôtre (1884)'],
        0,
        'Hiệp định Genève công nhận độc lập, chủ quyền, thống nhất và toàn vẹn lãnh thổ của Việt Nam, Lào và Campuchia.',
      ],
      [
        'Hiệp định Paris về chấm dứt chiến tranh, lập lại hòa bình ở Việt Nam được ký kết vào thời điểm nào?',
        ['Ngày 27/1/1973', 'Ngày 30/4/1975', 'Ngày 21/7/1954', 'Ngày 2/7/1976'],
        0,
        'Sau chiến thắng "Điện Biên Phủ trên không" cuối năm 1972, Hoa Kỳ phải ký Hiệp định Paris và rút toàn bộ quân viễn chinh.',
      ],
      [
        'Chiến dịch lịch sử mang tên Hồ Chí Minh toàn thắng vào trưa ngày 30/4/1975 có ý nghĩa lịch sử trọng đại nào?',
        [
          'Giải phóng hoàn toàn miền Nam, thống nhất đất nước, kết thúc 21 năm kháng chiến chống Mỹ',
          'Mở đầu công cuộc công nghiệp hóa lần thứ nhất',
          'Gia nhập Tổ chức Thương mại Thế giới WTO',
          'Ký kết Hiệp định thương mại ASEAN',
        ],
        0,
        'Đại thắng mùa Xuân 1975 mở ra kỷ nguyên hòa bình, độc lập, thống nhất và đi lên xây dựng đất nước.',
      ],
      [
        'Đường lối Đổi mới toàn diện đất nước, chuyển từ kinh tế kế hoạch hóa tập trung sang kinh tế thị trường định hướng XHCN được đề ra tại Đại hội Đảng lần thứ mấy?',
        ['Đại hội VI (tháng 12/1986)', 'Đại hội IV (1976)', 'Đại hội V (1982)', 'Đại hội VIII (1996)'],
        0,
        'Đại hội VI (1986) đánh dấu bước ngoặt lịch sử đưa Việt Nam thoát khỏi khủng hoảng kinh tế - xã hội và hội nhập sâu rộng quốc tế.',
      ],
    ]
  ),

  makeSet(
    'univ-hist-world-classical',
    'Lịch sử Thế giới Cổ – Trung đại',
    'Lịch sử Thế giới',
    ['Lịch sử', 'Thế giới', 'Cổ - Trung đại'],
    [
      [
        'Bốn trung tâm văn minh lớn đầu tiên của phương Đông cổ đại hình thành gắn liền với lưu vực các con sông lớn nào?',
        [
          'Ai Cập (sông Nin), Lưỡng Hà (Tigris–Euphrates), Ấn Độ (sông Ấn–Hằng), Trung Hoa (Hoàng Hà–Trường Giang)',
          'Hy Lạp, La Mã, Maya, Inca',
          'Anh, Pháp, Đức, Tây Ban Nha',
          'Nhật Bản, Triều Tiên, Mông Cổ, Nga',
        ],
        0,
        'Phù sa màu mỡ và nhu cầu trị thủy ở các dòng sông lớn là cơ sở hình thành nông nghiệp và nhà nước cổ đại phương Đông.',
      ],
      [
        'Bộ luật thành văn cổ xưa nổi tiếng nhất của nền văn minh Lưỡng Hà cổ đại (thế kỷ XVIII TCN) là:',
        ['Bộ luật Hammurabi', 'Luật 12 Bảng của La Mã', 'Hiến chương Magna Carta', 'Luật Justinian'],
        0,
        'Bộ luật Hammurabi (Babylon) gồm 282 điều khắc trên bia đá bazan đen, nổi tiếng với nguyên tắc tương xứng.',
      ],
      [
        'Thể chế dân chủ trực tiếp (Direct Democracy) đầu tiên trong lịch sử nhân loại xuất hiện và phát triển rực rỡ nhất tại thành bang nào?',
        ['Athens (Hy Lạp cổ đại)', 'Sparta', 'Carthage', 'Alexandria'],
        0,
        'Tại Athens thế kỷ V TCN (thời Pericles), công dân nam tự do trực tiếp thảo luận và biểu quyết tại Đại hội công dân.',
      ],
      [
        'Sự kiện nào năm 476 SCN thường được sử học phương Tây lấy làm mốc kết thúc thời kỳ Cổ đại và mở đầu thời kỳ Trung đại châu Âu?',
        [
          'Sự sụp đổ của Đế chế Tây La Mã',
          'Sự thành lập Đế chế Đông La Mã (Byzantine)',
          'Cuộc phát kiến châu Mỹ của Columbus',
          'Cách mạng tư sản Anh',
        ],
        0,
        'Hoàng đế Romulus Augustulus bị phế truất năm 476 đánh dấu sự tan rã của Tây La Mã và sự hình thành các vương quốc phong kiến châu Âu.',
      ],
      [
        'Bốn phát minh vĩ đại của Trung Quốc cổ – trung đại làm thay đổi lịch sử nhân loại gồm:',
        [
          'Kỹ thuật làm giấy, nghề in, la bàn và thuốc súng',
          'Động cơ hơi nước, điện thoại, bóng đèn và máy bay',
          'Chữ tượng hình, kim tự tháp, lịch mặt trời và đồng hồ cát',
          'Thép không gỉ, kính hiển vi, tàu ngầm và bản đồ Mercator',
        ],
        0,
        'Tứ đại phát minh của Trung Hoa truyền sang châu Âu qua thế giới Ả Rập đã thúc đẩy mạnh mẽ thời Phục hưng và phát kiến địa lý.',
      ],
      [
        'Phong trào Văn hóa Phục hưng (Renaissance, thế kỷ XIV–XVI) khởi nguồn từ quốc gia nào và đề cao hệ tư tưởng trung tâm nào?',
        [
          'Ý (Italy) — Chủ nghĩa nhân văn (Humanism), đề cao giá trị con người và lý trí',
          'Nga — Chủ nghĩa thần quyền tuyệt đối',
          'Pháp — Chủ nghĩa thực dân đế quốc',
          'Đức — Chủ nghĩa hiện sinh thế kỷ XX',
        ],
        0,
        'Phục hưng bắt đầu từ các thành thị thương mại giàu có ở Ý (Florence, Venice) với các danh nhân như Leonardo da Vinci, Michelangelo, Galileo.',
      ],
      [
        'Tuyến thương mại xuyên lục địa nối liền Đông Á với Trung Á, Trung Đông và Địa Trung Hải từ thời nhà Hán được gọi là gì?',
        ['Con đường Tơ lụa (Silk Road)', 'Con đường Hổ phách', 'Hành lang Đại Tây Dương', 'Tuyến Cape Horn'],
        0,
        'Con đường Tơ lụa không chỉ trao đổi hàng hóa mà còn là cầu nối giao lưu tôn giáo, khoa học và văn hóa Đông – Tây.',
      ],
      [
        'Cuộc phát kiến địa lý năm 1498 của Vasco da Gama có ý nghĩa kinh tế – lịch sử quan trọng nào?',
        [
          'Tìm ra đường biển trực tiếp từ châu Âu vòng qua mũi Hảo Vọng tới Ấn Độ',
          'Hoàn thành chuyến đi vòng quanh Trái Đất lần đầu tiên',
          'Khám phá ra châu Úc và New Zealand',
          'Đào xong kênh đào Suez nối Địa Trung Hải với Biển Đỏ',
        ],
        0,
        'Vasco da Gama mở ra tuyến thương mại gia vị đường biển trực tiếp cho Bồ Đào Nha, làm dịch chuyển trọng tâm thương mại thế giới sang Đại Tây Dương.',
      ],
    ]
  ),

  makeSet(
    'univ-hist-world-modern',
    'Lịch sử Thế giới Cận – Hiện đại',
    'Lịch sử Thế giới',
    ['Lịch sử', 'Thế giới', 'Hiện đại'],
    [
      [
        'Cuộc Cách mạng Công nghiệp lần thứ nhất (nửa sau thế kỷ XVIII) bắt đầu từ quốc gia nào và gắn với phát minh đột phá nào?',
        [
          'Nước Anh — Máy hơi nước của James Watt và ngành dệt cơ khí',
          'Nước Mỹ — Dây chuyền lắp ráp ô tô của Henry Ford',
          'Nước Đức — Mạng Internet toàn cầu',
          'Nước Pháp — Lò phản ứng hạt nhân',
        ],
        0,
        'Nhờ tích lũy tư bản, tài nguyên than sắt và thị trường thuộc địa, Anh đi đầu trong cơ giới hóa sản xuất bằng máy hơi nước.',
      ],
      [
        'Bản Tuyên ngôn Nhân quyền và Dân quyền năm 1789 với khẩu hiệu "Tự do – Bình đẳng – Bác ái" là thành quả của cuộc cách mạng nào?',
        ['Cách mạng Tư sản Pháp', 'Cách mạng Tân Hợi', 'Cách mạng Tháng Mười Nga', 'Cuộc Duy tân Minh Trị'],
        0,
        'Cách mạng Pháp 1789 làm lung lay tận gốc chế độ phong kiến chuyên chế khắp châu Âu và định hình chuẩn mực nhà nước pháp quyền hiện đại.',
      ],
      [
        'Cuộc Duy tân Minh Trị (1868) ở Nhật Bản đã đem lại kết quả lịch sử đặc biệt nào?',
        [
          'Đưa Nhật Bản trở thành nước tư bản công nghiệp hiện đại duy nhất ở châu Á thoát khỏi nguy cơ thuộc địa',
          'Đưa Nhật Bản trở về chế độ Mạc phủ đóng cửa hoàn toàn',
          'Hợp nhất Nhật Bản vào Đế chế Nga',
          'Xóa bỏ toàn bộ ngành giáo dục công lập',
        ],
        0,
        'Cải cách toàn diện về chính trị, kinh tế, quân sự và giáo dục giúp Nhật Bản nhanh chóng hiện đại hóa.',
      ],
      [
        'Nguyên nhân trực tiếp châm ngòi cho Chiến tranh Thế giới thứ nhất (1914–1918) là sự kiện nào?',
        [
          'Vụ ám sát Thái tử Áo–Hung Franz Ferdinand tại Sarajevo ngày 28/6/1914',
          'Quân Đức tấn công Ba Lan ngày 1/9/1939',
          'Cuộc khủng hoảng tên lửa Cuba năm 1962',
          'Trận Trân Châu Cảng năm 1941',
        ],
        0,
        'Mâu thuẫn thuộc địa giữa khối Liên minh và khối Hiệp ước đã bùng phát ngay sau sự kiện Sarajevo.',
      ],
      [
        'Hội nghị quốc tế nào tháng 2/1945 giữa Liên Xô, Mỹ và Anh đã định hình trật tự thế giới hai cực sau Chiến tranh Thế giới thứ hai?',
        ['Hội nghị Yalta', 'Hội nghị Versailles', 'Hội nghị Bandung', 'Hội nghị Helsinki'],
        0,
        'Hội nghị Yalta phân chia phạm vi ảnh hưởng ở châu Âu, châu Á và thống nhất thành lập tổ chức Liên Hợp Quốc.',
      ],
      [
        'Kế hoạch Marshall (1947) của Hoa Kỳ thực hiện mục tiêu gì trong giai đoạn đầu Chiến tranh Lạnh?',
        [
          'Viện trợ kinh tế khổng lồ tái thiết Tây Âu và ngăn chặn ảnh hưởng của khối Xô viết',
          'Đưa con người lần đầu tiên đặt chân lên Mặt Trăng',
          'Thành lập đồng tiền chung Euro ngay lập tức',
          'Giải giáp toàn bộ vũ khí hạt nhân toàn cầu',
        ],
        0,
        'Khoảng 13 tỷ USD viện trợ giúp Tây Âu phục hồi thần tốc và củng cố liên minh phương Tây.',
      ],
      [
        'Sự kiện nào năm 1991 chính thức chấm dứt Chiến tranh Lạnh và trật tự thế giới hai cực Yalta?',
        [
          'Sự tan rã của Liên bang Cộng hòa Xã hội Chủ nghĩa Xô viết (Liên Xô)',
          'Sự kiện thành lập Tổ chức NATO năm 1949',
          'Cuộc khủng hoảng dầu mỏ năm 1973',
          'Sự ra đời của Hiệp hội ASEAN năm 1967',
        ],
        0,
        'Liên Xô giải thể tháng 12/1991 khép lại thời kỳ đối đầu hai cực kéo dài hơn 4 thập kỷ, chuyển sang xu thế đa cực và toàn cầu hóa.',
      ],
      [
        'Cách mạng Công nghiệp lần thứ tư (Industry 4.0) có đặc trưng nổi bật nhất là sự hội tụ của những công nghệ nào?',
        [
          'Trí tuệ nhân tạo (AI), Internet vạn vật (IoT), Dữ liệu lớn (Big Data), Điện toán đám mây và Công nghệ sinh học',
          'Động cơ hơi nước và đường sắt chạy than đá',
          'Sản xuất hàng loạt bằng năng lượng điện thuần túy',
          'Kỹ thuật đúc đồng và rèn sắt thủ công',
        ],
        0,
        'Industry 4.0 xóa nhòa ranh giới giữa thế giới vật lý, thế giới số và sinh học thông qua AI và kết nối thông minh.',
      ],
    ]
  ),

  makeSet(
    'univ-bio-cell-genetics',
    'Sinh học Đại cương: Tế bào & Di truyền',
    'Sinh học Đại học',
    ['Sinh học', 'Di truyền', 'Tế bào'],
    [
      [
        'Theo Học thuyết Trung tâm (Central Dogma) của Sinh học phân tử, dòng thông tin di truyền cơ bản đi theo chiều nào?',
        ['DNA → RNA → Protein', 'Protein → RNA → DNA', 'Lipid → DNA → Protein', 'RNA → Lipid → Carbohydrate'],
        0,
        'DNA phiên mã (transcription) tạo mRNA, sau đó mRNA dịch mã (translation) tại ribosome để tổng hợp chuỗi polypeptide.',
      ],
      [
        'Trong hô hấp tế bào hiếu khí, giai đoạn nào tạo ra lượng ATP lớn nhất?',
        ['Chuỗi chuyền electron và phosphoryl hóa oxy hóa ở màng trong ty thể', 'Đường phân (Glycolysis) ở bào tương', 'Chu trình Krebs (Acid Citric)', 'Lên men lactic kỵ khí'],
        0,
        'Chuỗi chuyền electron tạo động lực proton H+ qua ATP synthase, sinh khoảng 26–28 ATP trên mỗi phân tử glucose.',
      ],
      [
        'Enzyme nào chịu trách nhiệm tháo xoắn chuỗi xoắn kép DNA tại chạc chữ Y trong quá trình nhân đôi DNA?',
        ['DNA Helicase', 'DNA Ligase', 'RNA Polymerase', 'Restriction Endonuclease'],
        0,
        'Helicase cắt đứt liên kết hydro giữa hai mạch bổ sung để tạo hai mạch khuôn cho DNA Polymerase tổng hợp.',
      ],
      [
        'Mạch DNA ra chậm (Lagging strand) được tổng hợp gián đoạn thành các đoạn ngắn theo chiều 5′→3′ gọi là gì?',
        ['Các đoạn Okazaki', 'Các đoạn Intron', 'Các đoạn Telomere', 'Các đoạn Promoter'],
        0,
        'Do DNA Polymerase chỉ tổng hợp theo chiều 5′→3′, mạch ra chậm phải tổng hợp từng đoạn Okazaki rồi nối lại bằng DNA Ligase.',
      ],
      [
        'Trong công nghệ chỉnh sửa gen CRISPR-Cas9, vai trò của phân tử gRNA (guide RNA) là gì?',
        [
          'Dẫn đường cho enzyme Cas9 đến cắt chính xác trình tự DNA đích dựa trên nguyên tắc bắt cặp bổ sung',
          'Cung cấp năng lượng ATP cho phản ứng PCR',
          'Phân hủy hoàn toàn màng tế bào vi khuẩn',
          'Tổng hợp trực tiếp kháng thể đơn dòng',
        ],
        0,
        'gRNA mang trình tự bổ sung ~20 nucleotide giúp Cas9 nhận diện vị trí cắt kép DNA đặc hiệu gần trình tự PAM.',
      ],
      [
        'Ở sinh vật nhân thực, quá trình cắt bỏ intron và nối các exon của tiền-mRNA (pre-mRNA) gọi là gì?',
        ['Splicing (Cắt nối RNA)', 'Translation', 'Replication', 'Transduction'],
        0,
        'Phức hợp Spliceosome thực hiện cắt nối RNA; Alternative Splicing còn giúp 1 gen tạo ra nhiều isoform protein khác nhau.',
      ],
      [
        'Màng sinh chất theo mô hình Khảm lỏng (Fluid Mosaic Model) của Singer và Nicolson có cấu trúc nền tảng là gì?',
        ['Lớp kép phospholipid với các protein xuyên màng, bám màng và cholesterol xen kẽ linh hoạt', 'Lớp cellulose cứng tuyệt đối', 'Chuỗi đơn axit nucleic khép kín', 'Mạng tinh thể canxi cacbonat'],
        0,
        'Tính lưỡng cực của phospholipid tạo lớp kép bán thấm chọn lọc và chuyển động linh hoạt ở nhiệt độ sinh lý.',
      ],
      [
        'Trong nguyên phân (Mitosis), các nhiễm sắc thể kép xếp thành một hàng trên mặt phẳng xích đạo của thoi phân bào ở kỳ nào?',
        ['Kỳ giữa (Metaphase)', 'Kỳ đầu (Prophase)', 'Kỳ sau (Anaphase)', 'Kỳ cuối (Telophase)'],
        0,
        'Ở kỳ giữa, NST đóng xoắn cực đại và thẳng hàng tại mặt phẳng xích đạo, rất thuận lợi để quan sát bộ nhiễm sắc thể (Karyotype).',
      ],
    ]
  ),

  makeSet(
    'univ-bio-evolution-eco',
    'Sinh học: Tiến hóa, Sinh lý & Hệ sinh thái',
    'Sinh học Đại học',
    ['Sinh học', 'Tiến hóa', 'Sinh thái'],
    [
      [
        'Theo thuyết tiến hóa tổng hợp hiện đại, nhân tố nào vừa làm thay đổi tần số alen một cách có hướng vừa hình thành đặc điểm thích nghi?',
        ['Chọn lọc tự nhiên (Natural Selection)', 'Phiêu bạt di truyền (Genetic Drift)', 'Đột biến ngẫu nhiên', 'Di – nhập gen (Gene Flow)'],
        0,
        'Chỉ có Chọn lọc tự nhiên tác động định hướng lên kiểu hình, giữ lại các tổ hợp gen thích nghi nhất với môi trường.',
      ],
      [
        'Phương trình cân bằng di truyền quần thể Hardy–Weinberg có dạng chuẩn đối với 1 gen 2 alen (p + q = 1) là:',
        ['p² + 2pq + q² = 1', 'p² − 2pq + q² = 0', 'p + q² = 1', '2p + 2q = 1'],
        0,
        'Trong quần thể ngẫu phối lớn không có nhân tố tiến hóa, tần số kiểu gen AA, Aa, aa duy trì không đổi theo p² : 2pq : q².',
      ],
      [
        'Trong hệ thần kinh người, điện thế hoạt động (Action Potential) khử cực mạnh màng neuron chủ yếu do sự mở ồ ạt của kênh ion nào?',
        ['Kênh Na⁺ đóng mở theo điện thế (Na⁺ tràn vào trong tế bào)', 'Kênh Cl⁻ đi vào tế bào', 'Kênh K⁺ đi vào tế bào', 'Bơm Proton H⁺'],
        0,
        'Khi vượt ngưỡng kích thích (~-55mV), kênh Na⁺ mở nhanh đưa điện thế màng từ -70mV lên khoảng +30mV.',
      ],
      [
        'Trong hệ miễn dịch đặc hiệu, tế bào nào chịu trách nhiệm sản xuất trực tiếp các phân tử kháng thể (Immunoglobulin)?',
        ['Tương bào (Plasma cell) biệt hóa từ tế bào Lympho B', 'Hồng cầu trưởng thành', 'Tiểu cầu', 'Tế bào thần kinh đệm'],
        0,
        'Khi nhận diện kháng nguyên đặc hiệu, tế bào Lympho B hoạt hóa và biệt hóa thành tương bào tiết kháng thể và tế bào B nhớ.',
      ],
      [
        'Trong chuỗi thức ăn sinh thái, hiệu suất sinh thái (năng lượng truyền từ bậc dinh dưỡng thấp lên bậc kế tiếp) trung bình xấp xỉ bao nhiêu phần trăm?',
        ['Khoảng 10%', 'Khoảng 90%', 'Khoảng 50%', 'Đạt 100%'],
        0,
        'Theo quy luật 10% của Lindeman, khoảng 90% năng lượng bị thất thoát qua hô hấp, nhiệt và chất thải ở mỗi bậc dinh dưỡng.',
      ],
      [
        'Quá trình quang hợp pha sáng tại màng thylakoid của lục lạp tạo ra hai sản phẩm giàu năng lượng dùng cho chu trình Calvin là:',
        ['ATP và NADPH (kèm giải phóng O₂)', 'Glucose và CO₂', 'Acid Pyruvic và Ethanol', 'Urea và Amoniac'],
        0,
        'Pha sáng chuyển quang năng thành hóa năng trong ATP và NADPH để pha tối cố định CO₂ thành đường.',
      ],
      [
        'Hiện tượng cơ quan tương đồng (Homologous structures — ví dụ chi trước người, cánh dơi, vây cá voi) là bằng chứng của quá trình nào?',
        ['Tiến hóa phân ly từ một tổ tiên chung', 'Tiến hóa hội tụ hoàn toàn không cùng gốc', 'Đột biến đa bội nhân tạo', 'Di truyền ngoài nhân'],
        0,
        'Các loài có cùng cấu trúc giải phẫu cơ bản nhưng biến đổi chức năng thích nghi với môi trường sống khác nhau.',
      ],
      [
        'Loại hormone nào do tuyến tụy tiết ra giúp hạ đường huyết bằng cách kích thích tế bào hấp thu glucose và chuyển hóa thành glycogen?',
        ['Insulin', 'Glucagon', 'Adrenaline', 'Thyroxine'],
        0,
        'Tế bào beta đảo tụy tiết Insulin làm giảm nồng độ glucose máu; ngược lại tế bào alpha tiết Glucagon làm tăng đường huyết.',
      ],
    ]
  ),

  makeSet(
    'univ-phys-mechanics-em',
    'Vật lý Đại cương: Cơ học & Điện từ học',
    'Vật lý Đại học',
    ['Vật lý', 'Cơ học', 'Điện từ'],
    [
      [
        'Định luật bảo toàn mômen động lượng phát biểu rằng mômen động lượng của một hệ kín không đổi khi nào?',
        [
          'Tổng mômen ngoại lực tác dụng lên hệ bằng 0',
          'Tổng vận tốc các hạt bằng 0',
          'Hệ luôn chuyển động thẳng đều không quay',
          'Nhiệt độ của hệ đạt 0 Kelvin',
        ],
        0,
        'dL/dt = τ_ext; khi mômen ngoại lực bằng 0, L = Iω được bảo toàn (ví dụ vận động viên trượt băng thu tay lại sẽ quay nhanh hơn).',
      ],
      [
        'Trong phương trình Maxwell, định luật cảm ứng điện từ Faraday (∇ × E = −∂B/∂t) giải thích hiện tượng vật lý nào?',
        [
          'Từ trường biến thiên theo thời gian sinh ra điện trường xoáy',
          'Điện tích đứng yên sinh ra từ trường mạnh',
          'Tồn tại đơn cực từ tự do trong tự nhiên',
          'Sóng âm truyền được trong chân không',
        ],
        0,
        'Sự biến thiên của từ thông sinh ra suất điện động cảm ứng — nền tảng của máy phát điện và máy biến áp.',
      ],
      [
        'Nguyên lý II Nhiệt động lực học phát biểu theo entropy của một hệ cô lập như thế nào?',
        [
          'Entropy của hệ cô lập không bao giờ giảm (ΔS ≥ 0) trong mọi quá trình tự nhiên',
          'Nhiệt luôn tự truyền từ vật lạnh sang vật nóng',
          'Có thể chế tạo động cơ nhiệt đạt hiệu suất 100%',
          'Nội năng khí lý tưởng không phụ thuộc nhiệt độ',
        ],
        0,
        'Trong quá trình thuận nghịch ΔS = 0, còn mọi quá trình bất thuận nghịch tự phát đều làm tăng entropy toàn phần.',
      ],
      [
        'Hiệu suất tối đa lý thuyết của một động cơ nhiệt Carnot hoạt động giữa nguồn nóng T₁ và nguồn lạnh T₂ (tính theo độ Kelvin) là:',
        ['η = 1 − T₂/T₁', 'η = 1 + T₂/T₁', 'η = T₁ / T₂', 'η = (T₁ − T₂) × T₁'],
        0,
        'Hiệu suất Carnot chỉ phụ thuộc vào nhiệt độ tuyệt đối của hai nguồn nhiệt và luôn nhỏ hơn 100%.',
      ],
      [
        'Lực Lorentz tác dụng lên hạt mang điện tích q chuyển động với vận tốc v trong điện trường E và từ trường B có biểu thức vector là:',
        ['F = q(E + v × B)', 'F = q(E · v) + B', 'F = m(E + B)', 'F = qv² / B'],
        0,
        'Thành phần từ lực q(v × B) luôn vuông góc với vận tốc v nên chỉ làm đổi hướng chuyển động mà không sinh công.',
      ],
      [
        'Phương trình Bernoulli cho dòng chất lưu lý tưởng chảy ổn định thể hiện định luật bảo toàn nào?',
        ['Định luật bảo toàn năng lượng trên một đơn vị thể tích chất lưu', 'Định luật bảo toàn điện tích', 'Định luật Hooke', 'Định luật Coulomb'],
        0,
        'P + ½ρv² + ρgh = const liên hệ áp suất tĩnh, áp suất động và thế năng trọng trường dọc theo đường dòng.',
      ],
      [
        'Trong mạch dao động RLC nối tiếp có nguồn xoay chiều, hiện tượng cộng hưởng điện xảy ra khi tần số góc ω thỏa mãn:',
        ['ω = 1 / √(LC)', 'ω = R / L', 'ω = L × C', 'ω = 1 / (RC)'],
        0,
        'Khi cảm kháng Z_L = dung kháng Z_C (ωL = 1/ωC), tổng trở đạt cực tiểu Z = R và dòng điện đạt cực đại.',
      ],
      [
        'Công thức tính động năng quay của một vật rắn có mômen quán tính I quay với vận tốc góc ω quanh trục cố định là:',
        ['K = ½ Iω²', 'K = Iω', 'K = ½ mω²', 'K = I²ω'],
        0,
        'Tương tự động năng tịnh tiến ½mv², khối lượng m tương ứng với mômen quán tính I và vận tốc v tương ứng với ω.',
      ],
    ]
  ),

  makeSet(
    'univ-phys-modern-quantum',
    'Vật lý Hiện đại: Lượng tử & Tương đối',
    'Vật lý Đại học',
    ['Vật lý', 'Lượng tử', 'Tương đối'],
    [
      [
        'Hệ thức bất định Heisenberg (Δx · Δp ≥ ħ/2) nói lên giới hạn cơ bản nào của thế giới vi mô?',
        [
          'Không thể xác định đồng thời vị trí và động lượng của hạt lượng tử với độ chính xác tùy ý',
          'Tốc độ ánh sáng thay đổi theo hướng bay của Trái Đất',
          'Năng lượng không được bảo toàn trong hạt nhân nguyên tử',
          'Electron không mang điện tích âm',
        ],
        0,
        'Đây là bản chất sóng–hạt nội tại của hàm sóng lượng tử, không phải do sai số thiết bị đo.',
      ],
      [
        'Hiện tượng Quang điện ngoài (Photoelectric Effect) do Einstein giải thích năm 1905 đã chứng minh trực tiếp điều gì?',
        [
          'Ánh sáng có tính chất hạt gồm các lượng tử năng lượng (photon) E = hf',
          'Ánh sáng chỉ có bản chất sóng thuần túy',
          'Hạt nhân nguyên tử chứa neutron trung hòa',
          'Trọng lực làm cong không-thời gian',
        ],
        0,
        'Mỗi photon có năng lượng hf phải lớn hơn công thoát kim loại mới bật được electron ra khỏi bề mặt, độc lập với cường độ sáng yếu hay mạnh.',
      ],
      [
        'Theo Thuyết Tương đối hẹp của Einstein, hai tiên đề nền tảng là Nguyên lý tương đối và điều gì?',
        [
          'Tốc độ ánh sáng trong chân không c là bất biến trong mọi hệ quy chiếu quán tính',
          'Thời gian trôi tuyệt đối giống nhau ở mọi nơi trong vũ trụ',
          'Khối lượng nghỉ tăng vô hạn ở vận tốc 0',
          'Mọi hành tinh chuyển động theo quỹ đạo tròn hoàn hảo',
        ],
        0,
        'Sự bất biến của c dẫn đến các hệ quả giãn nở thời gian, co ngắn độ dài và hệ thức năng lượng–khối lượng E = mc².',
      ],
      [
        'Bước sóng vật chất de Broglie của một hạt có động lượng p được xác định bởi công thức nào?',
        ['λ = h / p', 'λ = h × p', 'λ = p / h', 'λ = c / p'],
        0,
        'Louis de Broglie đề xuất mọi vật chất chuyển động đều mang lưỡng tính sóng–hạt với λ = h/(mv), được kiểm chứng qua nhiễu xạ electron.',
      ],
      [
        'Nguyên lý loại trừ Pauli (Pauli Exclusion Principle) phát biểu rằng trong một nguyên tử:',
        [
          'Không thể có hai electron (fermion) có cùng đồng thời 4 số lượng tử (n, l, m_l, m_s)',
          'Mọi photon phải có bước sóng khác nhau',
          'Các proton không thể ở cùng một hạt nhân',
          'Nhiệt độ không thể vượt quá 1000 K',
        ],
        0,
        'Nguyên lý Pauli giải thích cấu trúc lớp vỏ electron, bảng tuần hoàn nguyên tố hóa học và độ bền của sao lùn trắng.',
      ],
      [
        'Trong phương trình Schrödinger phụ thuộc thời gian, bình phương môđun hàm sóng |ψ(x, t)|² có ý nghĩa vật lý gì (theo cách hiểu Born)?',
        [
          'Mật độ xác suất tìm thấy hạt tại vị trí x ở thời điểm t',
          'Nhiệt độ tức thời của hạt',
          'Điện tích tổng cộng của hạt nhân',
          'Vận tốc ánh sáng trong môi trường',
        ],
        0,
        'Max Born đưa ra diễn giải xác suất cho hàm sóng lượng tử, đòi hỏi tích phân |ψ|² trên toàn không gian bằng 1.',
      ],
      [
        'Hiệu ứng đường hầm lượng tử (Quantum Tunneling) là cơ sở vận hành của thiết bị hiện đại nào sau đây?',
        [
          'Kính hiển vi quét đường hầm (STM), bộ nhớ Flash và phản ứng tổng hợp hạt nhân trong Mặt Trời',
          'Động cơ đốt trong 4 kỳ',
          'Cầu treo dây văng',
          'Máy hơi nước piston',
        ],
        0,
        'Sóng xác suất của hạt lượng tử có thể xuyên qua hàng rào thế năng cao hơn năng lượng cổ điển của nó.',
      ],
      [
        'Bức xạ nền vi sóng vũ trụ (CMB) phát hiện năm 1964 là bằng chứng quan sát mạnh mẽ nhất ủng hộ mô hình nào?',
        ['Thuyết Vụ Nổ Lớn (Big Bang)', 'Thuyết Vũ trụ Tĩnh vĩnh cửu', 'Thuyết Địa tâm Ptolemy', 'Thuyết ête cổ điển'],
        0,
        'CMB là tàn dư bức xạ nhiệt ~2.725 K từ giai đoạn vũ trụ sơ khai khoảng 380.000 năm sau Big Bang.',
      ],
    ]
  ),

  makeSet(
    'univ-chem-general-organic',
    'Hóa học Đại cương & Hữu cơ (Đại học)',
    'Hóa học Đại học',
    ['Hóa học', 'Hữu cơ', 'Nhiệt động'],
    [
      [
        'Một phản ứng hóa học ở nhiệt độ và áp suất không đổi tự diễn biến (spontaneous) khi năng lượng tự do Gibbs ΔG thỏa mãn điều kiện nào?',
        ['ΔG = ΔH − TΔS < 0', 'ΔG > 0', 'ΔG = 0', 'ΔH > 0 và ΔS < 0'],
        0,
        'Khi ΔG < 0 phản ứng tự phát theo chiều thuận; ΔG = 0 hệ đạt cân bằng hóa học.',
      ],
      [
        'Theo nguyên lý Le Chatelier, khi tăng áp suất của hệ cân bằng khí N₂ + 3H₂ ⇌ 2NH₃ ở nhiệt độ không đổi, cân bằng chuyển dịch theo chiều nào?',
        ['Chiều thuận (tạo thêm NH₃ vì giảm số mol khí từ 4 xuống 2)', 'Chiều nghịch', 'Không chuyển dịch', 'Phản ứng dừng hẳn'],
        0,
        'Hệ cân bằng chống lại tác động tăng áp suất bằng cách chuyển dịch về phía có ít phân tử khí hơn.',
      ],
      [
        'Trong thuyết lai hóa orbital (Hybridization), nguyên tử Carbon trong phân tử Benzene (C₆H₆) ở trạng thái lai hóa nào?',
        ['sp² (hình học phẳng, góc liên kết 120°)', 'sp³ (tứ diện)', 'sp (đường thẳng)', 'sp³d²'],
        0,
        '6 nguyên tử Carbon lai hóa sp² tạo khung vòng phẳng và hệ liên hợp π giải tỏa đều 6 electron bền vững (quy tắc Hückel 4n+2).',
      ],
      [
        'Dung dịch đệm (Buffer solution) gồm axit yếu HA và muối bazơ liên hợp A⁻ tính pH theo phương trình kinh điển nào?',
        ['Henderson–Hasselbalch: pH = pKa + log([A⁻]/[HA])', 'Arrhenius: k = A·e^(−Ea/RT)', 'Nernst: E = E° − (RT/nF)lnQ', 'Clapeyron: PV = nRT'],
        0,
        'Phương trình Henderson–Hasselbalch cho phép tính nhanh và pha chế dung dịch đệm ổn định pH trong sinh hóa và phân tích.',
      ],
      [
        'Cơ chế phản ứng thế ái nhân lưỡng phân tử SN2 trong hóa hữu cơ có đặc điểm lập thể nào nổi bật?',
        [
          'Xảy ra qua 1 giai đoạn chuyển tiếp duy nhất kèm nghịch đảo cấu hình Walden (Walden inversion)',
          'Tạo carbocation trung gian và cho hỗn hợp racemic',
          'Chỉ xảy ra với dẫn xuất halogen bậc 3 cồng kềnh',
          'Không phụ thuộc vào nồng độ tác nhân ái nhân',
        ],
        0,
        'Tác nhân ái nhân tấn công từ phía đối diện nhóm xuất (backside attack) làm đảo ngược cấu hình tâm bất đối.',
      ],
      [
        'Vai trò thực sự của chất xúc tác (Catalyst) trong động hóa học là gì?',
        [
          'Làm giảm năng lượng hoạt hóa (Ea) để tăng tốc độ cả chiều thuận và nghịch mà không làm thay đổi hằng số cân bằng K',
          'Làm tăng ΔG của sản phẩm lên gấp đôi',
          'Bị tiêu thụ hoàn toàn thành sản phẩm mới',
          'Chỉ tăng tốc độ chiều thuận và chặn đứng chiều nghịch',
        ],
        0,
        'Chất xúc tác mở ra con đường phản ứng có hàng rào năng lượng hoạt hóa thấp hơn, giúp hệ đạt cân bằng nhanh hơn.',
      ],
      [
        'Trong Hóa học Phối trí và Điện hóa, quá trình Oxi hóa (Oxidation) được định nghĩa chính xác là:',
        ['Quá trình nhường electron (số oxi hóa tăng)', 'Quá trình nhận electron (số oxi hóa giảm)', 'Quá trình kết tủa muối tan', 'Quá trình bay hơi dung môi'],
        0,
        'Ghi nhớ: "Khử cho – O nhận" — chất khử bị oxi hóa (nhường e⁻), chất oxi hóa bị khử (nhận e⁻).',
      ],
      [
        'Vì sao nước (H₂O) có nhiệt độ sôi (100°C) cao bất thường so với H₂S (−60°C) dù phân tử khối nhỏ hơn nhiều?',
        [
          'Giữa các phân tử H₂O hình thành mạng lưới liên kết Hydro (Hydrogen bonding) liên phân tử bền vững',
          'H₂O có liên kết ion cực mạnh như NaCl',
          'Nguyên tử Oxy nặng hơn nguyên tử Lưu huỳnh',
          'Nước là phân tử không phân cực',
        ],
        0,
        'Độ âm điện lớn của Oxy tạo liên kết hydro mạnh giữa các phân tử nước, đòi hỏi năng lượng lớn để hóa hơi.',
      ],
    ]
  ),

  makeSet(
    'univ-lit-vn-medieval',
    'Văn học Trung đại Việt Nam (Thế kỷ X–XIX)',
    'Văn học Việt Nam · Trung đại',
    ['Văn học', 'Trung đại', 'Việt Nam'],
    [
      [
        'Bài thơ "Nam quốc sơn hà" (thế kỷ XI) được xem là bản Tuyên ngôn Độc lập đầu tiên của Việt Nam thể hiện tư tưởng cốt lõi nào?',
        [
          'Khẳng định chủ quyền lãnh thổ bất khả xâm phạm của nước Nam đã định sẵn tại "thiên thư"',
          'Ca ngợi cuộc sống ẩn dật lánh đời nơi núi rừng',
          'Miêu tả lễ hội mùa xuân kinh thành Thăng Long',
          'Phản ánh nỗi đau chia cắt thời nội chiến',
        ],
        0,
        'Bốn câu thất ngôn tứ tuyệt khẳng định quyền độc lập dân tộc và ý chí quyết tâm đánh bại mọi kẻ thù xâm lược.',
      ],
      [
        'Trong "Bình Ngô đại cáo" (1428), Nguyễn Trãi đã mở rộng khái niệm chủ quyền quốc gia bằng tư tưởng nhân nghĩa gắn liền với điều gì?',
        [
          '"Việc nhân nghĩa cốt ở yên dân / Quân điếu phạt trước lo trừ bạo" — lấy dân làm gốc',
          'Đề cao quyền lực tuyệt đối của tầng lớp quý tộc ngoại bang',
          'Kêu gọi từ bỏ chữ viết và phong tục riêng',
          'Chỉ dựa vào yếu tố địa lý mà không cần văn hiến',
        ],
        0,
        'Nguyễn Trãi khẳng định Đại Việt là nước có nền văn hiến lâu đời, cương vực, phong tục và hào kiệt riêng bình đẳng với phương Bắc.',
      ],
      [
        'Kiệt tác "Truyện Kiều" (Đoạn trường tân thanh) của Đại thi hào Nguyễn Du gồm bao nhiêu câu thơ lục bát và viết bằng chữ gì?',
        ['3.254 câu thơ lục bát viết bằng chữ Nôm', '1.000 câu thơ thất ngôn viết bằng chữ Hán', '2.500 câu song thất lục bát viết bằng chữ Quốc ngữ', '4.000 câu thơ tự do'],
        0,
        'Nguyễn Du sáng tạo lại cốt truyện từ tiểu thuyết Trung Quốc thành đỉnh cao nghệ thuật ngôn từ chữ Nôm và chủ nghĩa nhân đạo Việt Nam.',
      ],
      [
        'Phong cách thơ Nôm độc đáo của "Bà Chúa Thơ Nôm" Hồ Xuân Hương cuối thế kỷ XVIII – đầu XIX nổi bật với đặc trưng nào?',
        [
          'Tiếng nói bênh vực quyền sống, quyền hạnh phúc của phụ nữ bằng ngôn ngữ dân gian sắc sảo, đa nghĩa và đầy bản lĩnh',
          'Thơ cung đình trang trọng viết hoàn toàn bằng chữ Hán',
          'Thơ ca ngợi chế độ đa thê phong kiến',
          'Văn tế chiến sĩ viết theo thể phú cổ điển',
        ],
        0,
        'Hồ Xuân Hương phá vỡ nhiều quy phạm khắc nghiệt của lễ giáo phong kiến bằng giọng điệu vừa trào phúng vừa thương cảm sâu sắc.',
      ],
      [
        'Tác phẩm "Văn tế nghĩa sĩ Cần Giuộc" (1861) của Nguyễn Đình Chiểu mang dấu ấn đột phá gì trong lịch sử văn học trung đại?',
        [
          'Lần đầu tiên tạc tượng đài bi tráng về người nông dân áo vải trở thành anh hùng chống thực dân Pháp',
          'Kể lại chuyện tình yêu cung đình thời Lê – Trịnh',
          'Ghi chép hành trình đi sứ sang châu Âu',
          'Tổng hợp các bài thuốc nam cổ truyền',
        ],
        0,
        'Nguyễn Đình Chiểu chuyển trọng tâm nhân vật anh hùng từ vua chúa, tướng lĩnh sang người dân ấp dân lân bình dị mà quả cảm.',
      ],
      [
        'Tập truyện ngắn bằng chữ Hán "Truyền kỳ mạn lục" (thế kỷ XVI) được mệnh danh là "Thiên cổ kỳ bút" là tác phẩm của ai?',
        ['Nguyễn Dữ', 'Ngô Sĩ Liên', 'Lê Quý Đôn', 'Cao Bá Quát'],
        0,
        'Truyền kỳ mạn lục gồm 20 truyện (tiêu biểu là Chuyện người con gái Nam Xương) dùng yếu tố kỳ ảo phản ánh hiện thực xã hội phong kiến.',
      ],
      [
        'Trong thơ trung đại, bút pháp "Tả cảnh ngụ tình" và tính quy phạm (ước lệ tượng trưng, điển cố) thường được sử dụng nhằm mục đích gì?',
        [
          'Gửi gắm tâm trạng, chí hướng quân tử và cảm thức vũ trụ thông qua hình ảnh thiên nhiên tinh tế',
          'Ghi chép số liệu kinh tế – thống kê chính xác',
          'Thay thế hoàn toàn ngôn ngữ đối thoại hằng ngày',
          'Tạo hiệu ứng giật gân theo kiểu tiểu thuyết trinh thám',
        ],
        0,
        'Bút pháp ước lệ (tùng, cúc, trúc, mai; mây, trăng, tuyết) kết hợp sáng tạo cá nhân tạo chiều sâu biểu cảm cho thơ trung đại.',
      ],
      [
        'Nhà thơ trào phúng xuất sắc cuối thế kỷ XIX – đầu XX với những vần thơ chua cay châm biếm xã hội "nửa Tây nửa ta" ở thành Nam là ai?',
        ['Trần Tế Xương (Tú Xương)', 'Nguyễn Bỉnh Khiêm', 'Nguyễn Công Trứ', 'Phạm Ngũ Lão'],
        0,
        'Cùng với Nguyễn Khuyến, Tú Xương đại diện cho đỉnh cao trào phúng và trữ tình hiện thực giai đoạn giao thời cuối trung đại.',
      ],
    ]
  ),

  makeSet(
    'univ-lit-vn-modern',
    'Văn học Cận & Hiện đại Việt Nam',
    'Văn học Việt Nam · Hiện đại',
    ['Văn học', 'Hiện đại', 'Việt Nam'],
    [
      [
        'Phong trào Thơ Mới (1932–1945) với các tên tuổi Xuân Diệu, Huy Cận, Hàn Mặc Tử, Chế Lan Viên đã tạo ra cuộc cách mạng nghệ thuật nào?',
        [
          'Giải phóng cái "Tôi" cá nhân trữ tình và phá vỡ niêm luật chặt chẽ của thơ Đường luật trung đại',
          'Quay trở lại viết toàn bộ thơ bằng chữ Hán cổ',
          'Loại bỏ hoàn toàn cảm xúc cá nhân khỏi thi ca',
          'Chỉ viết về đề tài chiến tranh hiện đại',
        ],
        0,
        'Hoài Thanh từng tổng kết trong "Thi nhân Việt Nam": tinh thần cốt lõi của Thơ Mới là sự thức tỉnh mạnh mẽ của chữ "Tôi".',
      ],
      [
        'Tiểu thuyết trào phúng hiện thực xuất sắc "Số Đỏ" (1936) với nhân vật Xuân Tóc Đỏ là kiệt tác của nhà văn nào?',
        ['Vũ Trọng Phụng', 'Ngô Tất Tố', 'Nam Cao', 'Thạch Lam'],
        0,
        'Vũ Trọng Phụng phơi bày bản chất lố lăng, giả dối của xã hội tư sản thành thị "Âu hóa" nửa mùa thời Pháp thuộc.',
      ],
      [
        'Tác phẩm "Chí Phèo" của Nam Cao đặt ra bi kịch sâu sắc nhất nào của người nông dân lương thiện trước Cách mạng tháng Tám?',
        [
          'Bi kịch bị tha hóa cả nhân hình lẫn nhân tính và bị xã hội cự tuyệt quyền làm người lương thiện',
          'Bi kịch thất bại trong kinh doanh thương mại',
          'Bi kịch không được ra nước ngoài du học',
          'Bi kịch mâu thuẫn giữa hai dòng họ quý tộc',
        ],
        0,
        'Câu hỏi đau đớn "Ai cho tao lương thiện?" trở thành đỉnh cao chủ nghĩa nhân đạo mới trong văn xuôi hiện thực phê phán.',
      ],
      [
        'Tuyên ngôn nghệ thuật "Nghệ thuật không cần phải là ánh trăng lừa dối, nghệ thuật có thể chỉ là tiếng đau khổ kia thoát ra từ những kiếp lầm than" là của nhà văn nào?',
        ['Nam Cao (trong truyện ngắn Trăng sáng)', 'Nhất Linh', 'Nguyễn Tuân', 'Tô Hoài'],
        0,
        'Nam Cao khẳng định quan điểm nghệ thuật vị nhân sinh, gắn chặt văn chương với đời sống và nỗi đau con người.',
      ],
      [
        'Đặc điểm bao trùm của văn học Việt Nam giai đoạn 1945–1975 (văn học hai cuộc kháng chiến) là gì?',
        [
          'Khuynh hướng sử thi và cảm hứng lãng mạn cách mạng, hướng về vận mệnh chung của cộng đồng dân tộc',
          'Tập trung hoàn toàn vào chủ nghĩa siêu thực huyền bí',
          'Phủ nhận hoàn toàn vai trò của lịch sử',
          'Chỉ sáng tác kịch phi lý phương Tây',
        ],
        0,
        'Các tác phẩm như Tây Tiến, Việt Bắc, Đất Nước, Rừng Xà Nu, Chiếc lược ngà thấm đẫm hào khí anh hùng và lý tưởng độc lập.',
      ],
      [
        'Sự chuyển mình mạnh mẽ của văn học Việt Nam sau năm 1975 (đặc biệt thời kỳ Đổi mới từ 1986) thể hiện rõ qua xu hướng nào?',
        [
          'Từ cảm hứng sử thi cộng đồng sang cảm hứng thế sự – đời tư, nhìn thẳng sự thật và khám phá chiều sâu đa diện của con người',
          'Ngừng hoàn toàn việc xuất bản tiểu thuyết',
          'Chuyển sang sáng tác thuần túy thơ lục bát cổ điển',
          'Cấm sử dụng kỹ thuật dòng ý thức',
        ],
        0,
        'Tiêu biểu là Nguyễn Minh Châu ("Chiếc thuyền ngoài xa"), Bảo Ninh ("Nỗi buồn chiến tranh"), Nguyễn Huy Thiệp, Lưu Quang Vũ.',
      ],
      [
        'Trong tùy bút "Người lái đò Sông Đà" (1960), Nguyễn Tuân xây dựng hình tượng ông lái đò nhằm ca ngợi điều gì?',
        [
          'Chất "vàng mười" của người lao động bình thường tài hoa, trí dũng chế ngự thiên nhiên Tây Bắc hùng vĩ',
          'Cuộc sống nhàn tản của tầng lớp nho sĩ xưa',
          'Sự phát triển của công nghiệp hàng không hiện đại',
          'Nỗi cô đơn tuyệt vọng nơi đô thị',
        ],
        0,
        'Sau cách mạng, cái "ngông" tài hoa của Nguyễn Tuân chuyển từ tìm cái đẹp quá vãng sang tôn vinh vẻ đẹp lao động hiện tại.',
      ],
      [
        'Tác phẩm kịch "Hồn Trương Ba, da hàng thịt" của Lưu Quang Vũ gửi gắm triết lý nhân sinh sâu sắc nào?',
        [
          'Con người phải được sống là chính mình toàn vẹn cả tâm hồn lẫn thể xác, không thể chấp nhận lối sống giả tạo chắp vá',
          'Vật chất quyết định tuyệt đối khiến đạo đức không còn giá trị',
          'Con người nên từ bỏ mọi cảm xúc để đạt bất tử',
          'Trí tuệ nhân tạo sẽ thay thế hoàn toàn kịch nói',
        ],
        0,
        'Tác phẩm mượn tích dân gian để đặt ra câu hỏi hiện đại về nhân cách, sự tha hóa và ý nghĩa đích thực của tồn tại.',
      ],
    ]
  ),

  makeSet(
    'univ-lit-world-classics',
    'Văn học Thế giới: Trung cổ – Cận – Hiện đại',
    'Văn học Thế giới',
    ['Văn học', 'Thế giới', 'Kinh điển'],
    [
      [
        'Trường ca "Thần khúc" (Divine Comedy — Địa ngục, Luyện ngục, Thiên đường) đánh dấu đỉnh cao giao thời Trung cổ – Phục hưng châu Âu là của tác giả nào?',
        ['Dante Alighieri (Ý)', 'Homer (Hy Lạp)', 'Virgil (La Mã)', 'Geoffrey Chaucer (Anh)'],
        0,
        'Dante viết Thần khúc bằng tiếng Ý bản địa thay vì tiếng Latinh, tạo nền móng cho văn học Phục hưng châu Âu.',
      ],
      [
        'Câu độc thoại bất hủ "To be, or not to be, that is the question" xuất hiện trong bi kịch nào của William Shakespeare?',
        ['Hamlet', 'Romeo và Juliet', 'Macbeth', 'Othello'],
        0,
        'Hoàng tử Hamlet suy tư sâu sắc về lẽ sống, sự tồn tại, công lý và trách nhiệm con người trong thời đại đầy biến động Phục hưng.',
      ],
      [
        'Tiểu thuyết "Don Quixote" (1605) của Miguel de Cervantes được coi là tiểu thuyết hiện đại đầu tiên của phương Tây vì lý do nào?',
        [
          'Dùng bút pháp giễu nhại tiểu thuyết hiệp sĩ trung cổ để khắc họa sự xung đột sâu sắc giữa lý tưởng cao đẹp và hiện thực trần trụi',
          'Là cuốn sách khoa học viễn tưởng đầu tiên về du hành vũ trụ',
          'Được viết hoàn toàn bằng thơ lục ngôn',
          'Không có bất kỳ nhân vật con người nào',
        ],
        0,
        'Cặp nhân vật Don Quixote (mơ mộng lý tưởng) và Sancho Panza (thực tế dân gian) tạo nên đối thoại đa thanh kinh điển.',
      ],
      [
        'Tác phẩm sử thi – lãng mạn nhân đạo đồ sộ "Những người khốn khổ" (Les Misérables, 1862) với nhân vật Jean Valjean là kiệt tác của nhà văn Pháp nào?',
        ['Victor Hugo', 'Honoré de Balzac', 'Gustave Flaubert', 'Albert Camus'],
        0,
        'Victor Hugo lên án bất công xã hội và ca ngợi sức mạnh cứu rỗi của lòng vị tha, lương tri con người.',
      ],
      [
        'Nhà văn Nga vĩ đại thế kỷ XIX nổi tiếng với "tiểu thuyết đa thanh" phân tích tâm lý tội lỗi và cứu chuộc qua "Tội ác và Hình phạt", "Anh em nhà Karamazov" là ai?',
        ['Fyodor Dostoevsky', 'Anton Chekhov', 'Maxim Gorky', 'Alexander Pushkin'],
        0,
        'Dostoevsky được Mikhail Bakhtin tôn vinh là người sáng tạo hình thức tiểu thuyết đa thanh đi sâu vào vực thẳm tâm lý hiện đại.',
      ],
      [
        'Truyện vừa "Hóa thân" (The Metamorphosis, 1915) kể về Gregor Samsa tỉnh dậy biến thành một con bọ khổng lồ phản ánh chủ đề hiện đại nào của Franz Kafka?',
        [
          'Sự tha hóa, cô độc phi lý và bất lực của con người nhỏ bé trước guồng máy xã hội – gia đình thực dụng',
          'Khát vọng chinh phục thiên nhiên bằng công nghệ sinh học',
          'Tình yêu lãng mạn của giới quý tộc châu Âu',
          'Chiến thắng vẻ vang trong Chiến tranh Thế giới thứ nhất',
        ],
        0,
        'Thuật ngữ "Kafkaesque" ra đời từ phong cách văn chương siêu thực – phi lý phơi bày thân phận bị tha hóa thế kỷ XX.',
      ],
      [
        'Tiểu thuyết "Trăm năm cô đơn" (One Hundred Years of Solitude, 1967) của Gabriel García Márquez là đỉnh cao của trào lưu văn học nào?',
        ['Chủ nghĩa Hiện thực Huyền ảo (Magical Realism) Mỹ Latinh', 'Chủ nghĩa Cổ điển Pháp thế kỷ XVII', 'Chủ nghĩa Tự nhiên học', 'Văn học Kỵ sĩ Trung cổ'],
        0,
        'Márquez hòa quyện những điều kỳ diệu phi thường vào đời sống thường nhật của dòng họ Buendía ở làng Macondo một cách tự nhiên.',
      ],
      [
        'Trong tiểu thuyết "Ông già và biển cả" (The Old Man and the Sea, 1952), Ernest Hemingway nổi tiếng với nguyên lý nghệ thuật nào?',
        [
          'Nguyên lý "Tảng băng trôi" (Iceberg Theory — một phần nổi hàm súc, bảy phần chìm giàu tầng nghĩa)',
          'Nguyên lý miêu tả rườm rà chi tiết mọi suy nghĩ nhân vật',
          'Nguyên lý phủ định hoàn toàn nghị lực con người',
          'Kỹ thuật viết truyện bằng mật mã số học',
        ],
        0,
        'Câu nói "Con người có thể bị hủy diệt chứ không thể bị đánh bại" thể hiện tầm vóc bi tráng trong lối viết tối giản của Hemingway.',
      ],
    ]
  ),
];
