import { FunctionComponent, useEffect, useState } from 'react';
import { toastError } from '../toasts';
import { createColumnHelper } from '@tanstack/react-table';
import TableCustom from '../components/TableCustom';
import { Account } from '../types';

interface AccountPageProps {
    type: "Current" | "Savings";
}

const AccountPage: FunctionComponent<AccountPageProps> = ({ type }) => {
    const [accountData, setAccountData] = useState<Array<Account>>([]);

    const columnHelper = createColumnHelper<Account>();

    const columns = [
        columnHelper.accessor('remarks', {
            header: 'Remarks',
            cell: (info) => info.getValue() ?? "-",
        }),
        columnHelper.accessor('createdAt', {
            header: 'Date',
            cell: (info) => new Date(info.getValue()).toLocaleDateString('en-IN'),
            enableColumnFilter: false,
        }),
        columnHelper.accessor(row => row.credited ? row.amount : 0, {
            header: 'Credited',
            cell: (info) => info.getValue().toLocaleString('en-IN', { style: 'currency', currency: 'INR' }),
            enableColumnFilter: false,
            meta : {
                getSum  : true,
                sumFormatter : sum => sum.toLocaleString("en-IN", {
                    style : "currency",
                    currency : "INR"
                })
            }
        }),
        columnHelper.accessor(row => !row.credited ? row.amount : 0, {
            header: 'Debited',
            cell: (info) => info.getValue().toLocaleString('en-IN', { style: 'currency', currency: 'INR' }),
            enableColumnFilter: false,
            meta : {
                getSum  : true,
                sumFormatter : sum => sum.toLocaleString("en-IN", {
                    style : "currency",
                    currency : "INR"
                })
            }
        }),
        columnHelper.accessor(row => row.transferable? "Yes" : "No" , {
            header: 'Transferable',
            cell: (info) => info.row.original.transferable.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }),
            meta : {
                getSum  : true,
                sumFormatter : sum => sum.toLocaleString("en-IN", {
                    style : "currency",
                    currency : "INR"
                }),
                filterType : "dropdown"
            }
        })
    ];

    const fetchAccountData = async () => {
        if (type) {
            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/account/${type}`, { credentials: "include" });
                const data = await response.json();
                setAccountData(data);
            } catch (error) {
                toastError("Error fetching data");
                console.error('Error fetching data:', error);
            }
        }
    };

    useEffect(() => {
        if (type) {
            fetchAccountData();
        }
    }, [type]);

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between mb-4">
                <h1 className="text-2xl font-bold">{type} Account</h1>
            </div>
            {accountData.length ? <TableCustom data={accountData} columns={columns} initialState={{
                sorting: [
                    {
                        id: "createdAt",
                        desc: true
                    }
                ]
            }} /> : <div>No {type} account data to show</div>}
        </div>
    )
};

export default AccountPage;
