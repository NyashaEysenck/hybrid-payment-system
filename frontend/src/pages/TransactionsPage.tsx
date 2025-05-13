
import { useState } from "react";
import Layout from "@/components/Layout";
import WhiteCard from "@/components/WhiteCard";
import TransactionItem from "@/components/TransactionItem";
import { useWallet } from "@/contexts/WalletContext";
import { 
  Filter, 
  Search, 
  Calendar, 
  Download,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const TransactionsPage = () => {
  const { transactions } = useWallet();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("all-time");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter and sort transactions
  const filteredTransactions = transactions
    .filter(tx => {
      // Filter by search term
      if (searchTerm && !tx.description.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !tx.recipient.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Filter by type
      if (filterType !== "all" && tx.type !== filterType) {
        return false;
      }
      
      // Filter by date
      if (filterDate !== "all-time") {
        const now = new Date();
        const txDate = new Date(tx.date);
        
        if (filterDate === "today" && 
            !(txDate.getDate() === now.getDate() && 
              txDate.getMonth() === now.getMonth() && 
              txDate.getFullYear() === now.getFullYear())) {
          return false;
        }
        
        if (filterDate === "this-week") {
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          
          if (txDate < startOfWeek) return false;
        }
        
        if (filterDate === "this-month") {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          if (txDate < startOfMonth) return false;
        }
      }
      
      return true;
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  
  // Implement pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterType("all");
    setFilterDate("all-time");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-dark">Transaction History</h1>
        
        {/* Filters */}
        <WhiteCard className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <div className="relative flex-1 w-full">
              <Search size={18} className="absolute left-3 top-2.5 text-dark-lighter" />
              <Input
                placeholder="Search transactions"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <Select 
                value={filterType} 
                onValueChange={setFilterType}
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <Filter size={16} className="mr-1" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="deposit">Deposits</SelectItem>
                  <SelectItem value="withdrawal">Withdrawals</SelectItem>
                  <SelectItem value="payment">Payments</SelectItem>
                  <SelectItem value="receipt">Receipts</SelectItem>
                  <SelectItem value="transfer">Transfers</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={filterDate} 
                onValueChange={setFilterDate}
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <Calendar size={16} className="mr-1" />
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-time">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
            <div className="text-dark-lighter mb-2 sm:mb-0">
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} found
              {(searchTerm || filterType !== "all" || filterDate !== "all-time") && (
                <Button 
                  variant="link" 
                  className="ml-2 h-auto p-0 text-greenleaf-600"
                  onClick={handleClearFilters}
                >
                  Clear filters
                </Button>
              )}
            </div>
            
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Download size={16} />
              Export
            </Button>
          </div>
          
          {/* Transactions List */}
          <div className="space-y-3">
            {paginatedTransactions.length > 0 ? (
              paginatedTransactions.map((transaction) => (
                <TransactionItem 
                  key={transaction.id} 
                  {...transaction} 
                  showDate
                />
              ))
            ) : (
              <div className="text-center py-12 text-dark-lighter">
                <Search size={32} className="mx-auto mb-2 opacity-50" />
                <p>No transactions found</p>
                {(searchTerm || filterType !== "all" || filterDate !== "all-time") && (
                  <p className="text-sm mt-1">Try adjusting your filters</p>
                )}
              </div>
            )}
          </div>
          
          {/* Pagination */}
          {filteredTransactions.length > 0 && (
            <Pagination className="mt-6">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  
                  // Adjust page numbers if we're near the end
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = currentPage - 3 + i;
                    if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                  }
                  
                  if (pageNum > 0 && pageNum <= totalPages) {
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          isActive={currentPage === pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }
                  return null;
                })}
                
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                
                {totalPages > 5 && currentPage < totalPages - 1 && (
                  <PaginationItem>
                    <PaginationLink onClick={() => setCurrentPage(totalPages)}>
                      {totalPages}
                    </PaginationLink>
                  </PaginationItem>
                )}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </WhiteCard>
      </div>
    </Layout>
  );
};

export default TransactionsPage;
