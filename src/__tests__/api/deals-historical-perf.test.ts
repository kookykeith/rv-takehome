// Mock Next.js server components before importing
jest.mock("next/server", () => {
  const mockNextRequest = jest.fn().mockImplementation((url, options) => ({
    url,
    method: options?.method || "GET",
    json: jest.fn().mockImplementation(() => {
      try {
        return Promise.resolve(JSON.parse(options?.body || "{}"));
      } catch (error) {
        return Promise.reject(new Error("Invalid JSON"));
      }
    }),
    text: jest.fn().mockResolvedValue(options?.body || ""),
  }));

  const mockNextResponse = {
    json: jest.fn((data, options) => ({
      json: async () => data,
      status: options?.status || 200,
    })),
  };

  return {
    NextRequest: mockNextRequest,
    NextResponse: mockNextResponse,
  };
});

// Mock the data source and repository
jest.mock("../../data-source");
jest.mock("../../lib/entities/deals/Deal");

// Mock the persistence layer
jest.mock("../../lib/persistence/deals", () => ({
  queryDealsCount: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "../../app/api/deals/historical-perf/route";
import { initializeDataSource } from "../../data-source";
import { queryDealsCount } from "../../lib/persistence/deals";

const mockInitializeDataSource = initializeDataSource as jest.MockedFunction<
  typeof initializeDataSource
>;
const mockQueryDealsCount = queryDealsCount as jest.MockedFunction<
  typeof queryDealsCount
>;

describe("/api/deals/historical-perf", () => {
  let mockRepository: any;
  let mockDataSource: any;

  beforeEach(() => {
    mockRepository = {
      createQueryBuilder: jest.fn(),
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    };

    mockInitializeDataSource.mockResolvedValue(mockDataSource);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/deals/historical-perf", () => {
    describe("Basic win rate calculation", () => {
      it("should calculate win rate correctly with equal won and lost deals", async () => {
        mockQueryDealsCount
          .mockResolvedValueOnce(5) // closed_won count
          .mockResolvedValueOnce(5); // closed_lost count

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.winRate).toBe(50);
        expect(data.totalClosedDeals).toBe(10);
        expect(data.closedWonCount).toBe(5);
        expect(data.closedLostCount).toBe(5);
        expect(mockQueryDealsCount).toHaveBeenCalledTimes(2);
      });

      it("should calculate win rate correctly with more won deals", async () => {
        mockQueryDealsCount
          .mockResolvedValueOnce(8) // closed_won count
          .mockResolvedValueOnce(2); // closed_lost count

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.winRate).toBe(80);
        expect(data.totalClosedDeals).toBe(10);
        expect(data.closedWonCount).toBe(8);
        expect(data.closedLostCount).toBe(2);
      });

      it("should calculate win rate correctly with more lost deals", async () => {
        mockQueryDealsCount
          .mockResolvedValueOnce(3) // closed_won count
          .mockResolvedValueOnce(7); // closed_lost count

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.winRate).toBe(30);
        expect(data.totalClosedDeals).toBe(10);
        expect(data.closedWonCount).toBe(3);
        expect(data.closedLostCount).toBe(7);
      });

      it("should return 0% win rate when no closed deals exist", async () => {
        mockQueryDealsCount
          .mockResolvedValueOnce(0) // closed_won count
          .mockResolvedValueOnce(0); // closed_lost count

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.winRate).toBe(0);
        expect(data.totalClosedDeals).toBe(0);
        expect(data.closedWonCount).toBe(0);
        expect(data.closedLostCount).toBe(0);
      });

      it("should return 100% win rate when only won deals exist", async () => {
        mockQueryDealsCount
          .mockResolvedValueOnce(10) // closed_won count
          .mockResolvedValueOnce(0); // closed_lost count

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.winRate).toBe(100);
        expect(data.totalClosedDeals).toBe(10);
        expect(data.closedWonCount).toBe(10);
        expect(data.closedLostCount).toBe(0);
      });

      it("should return 0% win rate when only lost deals exist", async () => {
        mockQueryDealsCount
          .mockResolvedValueOnce(0) // closed_won count
          .mockResolvedValueOnce(10); // closed_lost count

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.winRate).toBe(0);
        expect(data.totalClosedDeals).toBe(10);
        expect(data.closedWonCount).toBe(0);
        expect(data.closedLostCount).toBe(10);
      });
    });

    describe("Filter parameters", () => {
      it("should pass transportation_mode filter to queryDealsCount", async () => {
        mockQueryDealsCount
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(3);

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf?transportation_mode=Air"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.filters.transportation_mode).toBe("Air");
        expect(mockQueryDealsCount).toHaveBeenCalledWith(mockRepository, {
          stage: "closed_won",
          transportation_mode: "Air",
          sales_rep: null,
          min_value: null,
          max_value: null,
          min_date: null,
          max_date: null,
        });
        expect(mockQueryDealsCount).toHaveBeenCalledWith(mockRepository, {
          stage: "closed_lost",
          transportation_mode: "Air",
          sales_rep: null,
          min_value: null,
          max_value: null,
          min_date: null,
          max_date: null,
        });
      });

      it("should pass sales_rep filter to queryDealsCount", async () => {
        mockQueryDealsCount
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(2);

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf?sales_rep=John%20Doe"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.filters.sales_rep).toBe("John Doe");
        expect(mockQueryDealsCount).toHaveBeenCalledWith(mockRepository, {
          stage: "closed_won",
          transportation_mode: null,
          sales_rep: "John Doe",
          min_value: null,
          max_value: null,
          min_date: null,
          max_date: null,
        });
      });

      it("should pass min_value and max_value filters to queryDealsCount", async () => {
        mockQueryDealsCount
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(4);

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf?min_value=10000&max_value=50000"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.filters.min_value).toBe("10000");
        expect(data.filters.max_value).toBe("50000");
        expect(mockQueryDealsCount).toHaveBeenCalledWith(mockRepository, {
          stage: "closed_won",
          transportation_mode: null,
          sales_rep: null,
          min_value: 10000,
          max_value: 50000,
          min_date: null,
          max_date: null,
        });
      });

      it("should pass min_date and max_date filters to queryDealsCount", async () => {
        mockQueryDealsCount
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(1);

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf?min_date=2024-01-01&max_date=2024-12-31"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.filters.min_date).toBe("2024-01-01");
        expect(data.filters.max_date).toBe("2024-12-31");
        expect(mockQueryDealsCount).toHaveBeenCalledWith(mockRepository, {
          stage: "closed_won",
          transportation_mode: null,
          sales_rep: null,
          min_value: null,
          max_value: null,
          min_date: "2024-01-01",
          max_date: "2024-12-31",
        });
      });

      it("should handle all filters combined", async () => {
        mockQueryDealsCount
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(1);

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf?transportation_mode=Air&sales_rep=Jane&min_value=5000&max_value=25000&min_date=2024-01-01&max_date=2024-06-30"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.filters).toEqual({
          transportation_mode: "Air",
          sales_rep: "Jane",
          min_value: "5000",
          max_value: "25000",
          min_date: "2024-01-01",
          max_date: "2024-06-30",
        });
        expect(mockQueryDealsCount).toHaveBeenCalledWith(mockRepository, {
          stage: "closed_won",
          transportation_mode: "Air",
          sales_rep: "Jane",
          min_value: 5000,
          max_value: 25000,
          min_date: "2024-01-01",
          max_date: "2024-06-30",
        });
      });
    });

    describe("Error handling", () => {
      it("should handle database connection errors", async () => {
        mockInitializeDataSource.mockRejectedValue(
          new Error("Database connection failed")
        );

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Internal server error");
      });

      it("should handle queryDealsCount errors", async () => {
        mockQueryDealsCount
          .mockResolvedValueOnce(5)
          .mockRejectedValueOnce(new Error("Database query failed"));

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Internal server error");
      });

      it("should handle repository errors", async () => {
        mockDataSource.getRepository.mockImplementation(() => {
          throw new Error("Repository error");
        });

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Internal server error");
      });
    });

    describe("URL parsing", () => {
      it("should handle URL with no query parameters", async () => {
        mockQueryDealsCount
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(5);

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.filters).toEqual({
          transportation_mode: null,
          sales_rep: null,
          min_value: null,
          max_value: null,
          min_date: null,
          max_date: null,
        });
      });

      it("should handle URL with empty query parameters", async () => {
        mockQueryDealsCount
          .mockResolvedValueOnce(8)
          .mockResolvedValueOnce(4);

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf?transportation_mode=&sales_rep=&min_value=&max_value=&min_date=&max_date="
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.filters).toEqual({
          transportation_mode: "",
          sales_rep: "",
          min_value: "",
          max_value: "",
          min_date: "",
          max_date: "",
        });
      });

      it("should handle URL with special characters", async () => {
        mockQueryDealsCount
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(2);

        const request = new NextRequest(
          "http://localhost:3000/api/deals/historical-perf?sales_rep=John%20Doe%20%26%20Associates&transportation_mode=Air%20Freight"
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.filters.sales_rep).toBe("John Doe & Associates");
        expect(data.filters.transportation_mode).toBe("Air Freight");
      });
    });
  });
}); 