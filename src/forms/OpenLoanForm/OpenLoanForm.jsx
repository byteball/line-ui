import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ethers, parseUnits } from "ethers";
import ReactGA from "react-ga4";

import { Input } from "@/components/atoms";
import { MetaMaskButton, QuestionTooltip } from "@/components/molecules";

import {
	selectCollateralSymbol,
	selectSymbol,
} from "@/store/slices/settingsSlice";
import { selectParams } from "@/store/slices/paramsSlice";
import { sendNotification } from "@/store/thunks/sendNotification";

import contractAPI from "@/services/contractAPI";
import {
	toLocalString,
	getCountOfDecimals,
	recognizeMetamaskError,
} from "@/utils";
import { selectLinePrice } from "@/store/slices/priceSlice";
import { selectLoans } from "@/store/slices/loansSlice";

const INIT_COLLATERAL = 1;

const getLoanAmount = (collateralAmount, oracle, price) => {
	if (oracle === ethers.ZeroAddress) {
		return collateralAmount * 1000;
	} else {
		return collateralAmount / price;
	}
};

export const OpenLoanForm = () => {
	const [collateral, setCollateral] = useState({ value: "", valid: true });
	const [loan, setLoan] = useState({ value: "", valid: true });
	const [loading, setLoading] = useState(false);
	const btnRef = useRef();
	const dispatch = useDispatch();

	const symbol = useSelector(selectSymbol);
	const collateralSymbol = useSelector(selectCollateralSymbol);
	const price = useSelector(selectLinePrice);
	const params = useSelector(selectParams);
	const loans = useSelector(selectLoans);

	const { originationFee, interestRate } = useSelector(selectParams);

	const handleKeyDown = (ev) => {
		if (ev.code === "Enter" || ev.code === "NumpadEnter") {
			btnRef.current.click();
		}
	};

	useEffect(() => {
		handleCollateralChange(null, Number(collateral.value) || INIT_COLLATERAL);
	}, [price]);

	const handleCollateralChange = (ev, v) => {
		const value = v || ev.target.value.trim();
		const valid = !isNaN(Number(value)) && Number(value) > 0;

		if (value === "." || value === ",") {
			setCollateral({ value: "0.", valid: false });
		} else if (getCountOfDecimals(value) <= 18 && value <= 1e6) {
			setCollateral({ value, valid });

			if (valid) {
				const loanAmount = getLoanAmount(Number(value), params.oracle, price);

				setLoan({ value: loanAmount, valid: true });
			} else {
				setLoan({ value: 0, valid: false });
			}
		}
	};

	let netLoanAmount = 0;

	if (loan.valid) {
		netLoanAmount = loan.value - loan.value * originationFee;
	}

	const originationFeeAmount = Number(loan.value) - netLoanAmount;

	const openLoan = async () => {
		try {
			setLoading(true);

			await contractAPI.borrow(parseUnits(collateral.value.toString()));

			dispatch(
				sendNotification({
					title: "Transaction successful",
					type: "success",
				})
			);

			ReactGA.event({
				category: "loan",
				action: "open_loan",
				value: collateral.value,
				transport: "xhr"
			});
		} catch (error) {
			const notificationPayload = recognizeMetamaskError(error);
			dispatch(sendNotification(notificationPayload));
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			<Input
				label="Collateral amount"
				autoFocus={true}
				disabled={loading}
				value={collateral.value}
				error={!!collateral.value && !collateral.valid}
				labelDescription="The collateral you put in exchange for borrowing the LINE tokens. You can always repay the loan (plus interest) and get your collateral back."
				className="mb-3"
				placeholder=""
				suffix={collateralSymbol}
				onChange={handleCollateralChange}
				onKeyDown={handleKeyDown}
			/>

			<div className="mb-2">
				<div className="block mb-1 text-sm font-medium text-white/60">
					Interest rate{" "}
					<QuestionTooltip description="Yearly interest charged for holding the loan" />
					<span className="ml-1 text-gray-300">
						{+Number(interestRate * 100).toFixed(2)}%
					</span>
				</div>

				<div className="block mb-1 text-sm font-medium text-white/60">
					Loan amount{" "}
					<QuestionTooltip description="The initial amount of your loan. It will slowly grow as interest accrues." />{" "}
					<span className="ml-1 text-gray-300">
						{toLocalString(loan.value)}{" "}
						<small>{symbol}</small>
					</span>
				</div>
				<div className="block mb-1 text-sm font-medium text-white/60">
					Origination fee{" "}
					<QuestionTooltip
						description={`Fee charged for creating the loan: ${+Number(
							params.originationFee * 100
						).toFixed(2)}%`}
					/>{" "}
					<span className="ml-1 text-gray-300">
						{toLocalString(originationFeeAmount)}{" "}
						<small>{symbol}</small>
					</span>
				</div>
			</div>

			<div className="mb-5 text-white/80">
				You get:{" "}
				{loan.value && loan.valid ? toLocalString(netLoanAmount) : 0}{" "}
				<small>{symbol}</small>
			</div>

			<div className="text-center">
				<MetaMaskButton
					ref={btnRef}
					type="light"
					disabled={
						!loan.valid || !collateral.valid || !loan.value || !collateral.value
					}
					loading={loading}
					block
					className="blur-xs"
					onClick={openLoan}
				>
					Send {collateral.valid ? toLocalString(collateral.value) : ""}{" "}
					{collateralSymbol}
				</MetaMaskButton>
				{!loans.length && <div className="px-2 pt-2 text-xs text-center text-white/60">
					GBYTE is Obyte's native token, you can get it <a href="https://getmein.ooo/" target="_blank" className="text-primary" rel="noopener">here</a>
				</div>}
			</div>
		</>
	);
};
