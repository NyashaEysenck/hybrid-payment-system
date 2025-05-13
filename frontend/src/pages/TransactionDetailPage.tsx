
import { useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import WhiteCard from "@/components/WhiteCard";
import { useWallet } from "@/contexts/WalletContext";
import { 
  ArrowLeft, 
  Share2, 
  Download, 
  Clock, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  Repeat
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

const TransactionDetailPage = () => {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { transactions } = useWallet();
  
  // Find the transaction by ID
  const transaction = transactions.find(tx => tx.id === transactionId);
  
  // If transaction not found, show an error
  if (!transaction) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex items-center text-dark-lighter"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={16} className="mr-1" />
              Back
            </Button>
          </div>
          
          <WhiteCard className="p-6 text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-amber-500" />
            <h1 className="text-xl font-semibold text-dark mb-2">Transaction Not Found</h1>
            <p className="text-dark-lighter mb-6">
              The transaction you're looking for doesn't exist or may have been removed.
            </p>
            <Button onClick={() => navigate('/transactions')}>
              View All Transactions
            </Button>
          </WhiteCard>
        </div>
      </Layout>
    );
  }
  
  // Status badge renderer
  const renderStatusBadge = () => {
    const statusStyles = {
      completed: "bg-greenleaf-100 text-greenleaf-700",
      pending: "bg-amber-100 text-amber-700",
      failed: "bg-red-100 text-red-700"
    };
    
    const statusIcons = {
      completed: <CheckCircle2 size={16} />,
      pending: <Clock size={16} />,
      failed: <XCircle size={16} />
    };
    
    return (
      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${statusStyles[transaction.status]}`}>
        {statusIcons[transaction.status]}
        <span className="capitalize">{transaction.status}</span>
      </div>
    );
  };
  
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex items-center text-dark-lighter"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} className="mr-1" />
            Back to Transactions
          </Button>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Share2 size={16} />
              Share
            </Button>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Download size={16} />
              Download
            </Button>
          </div>
        </div>
        
        <WhiteCard className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-semibold text-dark">{transaction.description}</h1>
              <p className="text-dark-lighter">
                {format(transaction.date, "MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            {renderStatusBadge()}
          </div>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-6 text-center">
            <h2 className={`text-3xl font-bold ${transaction.amount > 0 ? 'text-greenleaf-600' : 'text-dark'}`}>
              {transaction.amount > 0 ? '+' : ''}{transaction.amount.toFixed(2)} USD
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-dark mb-4">Transaction Details</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-dark-lighter">Transaction Type</span>
                  <span className="text-dark font-medium capitalize">{transaction.type}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-dark-lighter">Transaction ID</span>
                  <span className="text-dark font-mono text-sm">{transaction.id}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-dark-lighter">Payment Method</span>
                  <span className="text-dark font-medium">
                    {transaction.method === 'offline' ? 'Offline QR' : 'Online'}
                  </span>
                </div>
                
                {transaction.reference && (
                  <div className="flex justify-between">
                    <span className="text-dark-lighter">Reference</span>
                    <span className="text-dark">{transaction.reference}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-dark mb-4">
                {transaction.amount > 0 ? 'Sender' : 'Recipient'}
              </h3>
              
              <div className="p-4 border rounded-lg">
                <p className="font-medium text-dark">{transaction.recipient}</p>
                {transaction.recipientEmail && (
                  <p className="text-dark-lighter text-sm">{transaction.recipientEmail}</p>
                )}
              </div>
              
              {transaction.note && (
                <div className="mt-4">
                  <h4 className="font-medium text-dark mb-1">Note</h4>
                  <p className="text-dark-lighter bg-gray-50 p-3 rounded-lg">
                    {transaction.note}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <Separator className="my-6" />
          
          {/* Transaction Timeline */}
          <div>
            <h3 className="text-lg font-semibold text-dark mb-4">Timeline</h3>
            
            <div className="space-y-4">
              {transaction.timeline ? (
                transaction.timeline.map((event, index) => (
                  <div key={index} className="flex items-start">
                    <div className="mr-3 mt-0.5">
                      <div className="w-8 h-8 rounded-full bg-greenleaf-100 flex items-center justify-center">
                        <CheckCircle2 size={16} className="text-greenleaf-600" />
                      </div>
                      {index < transaction.timeline.length - 1 && (
                        <div className="h-10 w-px bg-gray-200 mx-auto my-1"></div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-dark">{event.title}</p>
                      <p className="text-dark-lighter text-sm">{event.time}</p>
                      {event.description && (
                        <p className="text-dark-lighter text-sm mt-1">{event.description}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-start">
                  <div className="mr-3 mt-0.5">
                    <div className="w-8 h-8 rounded-full bg-greenleaf-100 flex items-center justify-center">
                      <CheckCircle2 size={16} className="text-greenleaf-600" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-dark">Transaction {transaction.status}</p>
                    <p className="text-dark-lighter text-sm">
                      {format(transaction.date, "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Transaction Actions (for pending transactions) */}
          {transaction.status === 'pending' && (
            <div className="mt-6 flex gap-3 justify-end">
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <XCircle size={16} />
                Cancel Transaction
              </Button>
              <Button size="sm" className="flex items-center gap-1 bg-greenleaf-600 hover:bg-greenleaf-700 text-white">
                <Repeat size={16} />
                Refresh Status
              </Button>
            </div>
          )}
        </WhiteCard>
      </div>
    </Layout>
  );
};

export default TransactionDetailPage;
