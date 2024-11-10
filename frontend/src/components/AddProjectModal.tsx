import { Button, Label, Modal, TextInput, FileInput, Radio, Textarea } from "flowbite-react";
import { Dispatch, FormEventHandler, FunctionComponent, SetStateAction, useEffect, useState } from "react";
import { toastError, toastSuccess, toastWarn } from "../toasts";
import { Member } from "../types";

interface AddProjectProps {
  openModal: boolean;
  setOpenModal: Dispatch<SetStateAction<boolean>>;
}

export const AddProjectModal: FunctionComponent<AddProjectProps> = ({ openModal, setOpenModal }) => {
  const [projectName, setProjectName] = useState<string>("");
  const [projectType, setProjectType] = useState<string>("yearly");  // Default to 'yearly'
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [projectHeads, setProjectHeads] = useState<{ [key: string]: number[] }>({});
  const [headTotals, setHeadTotals] = useState<{ [key: string]: number }>({});
  const [numberOfYears, setNumberOfYears] = useState<number>(0);
  const [numberOfInstallments, setNumberOfInstallments] = useState<number>(0);
  const [newHeadName, setNewHeadName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [sanctionLetter, setSanctionLetter] = useState<File | null>(null);
  const [description, setDescription] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [faculties, setFaculties] = useState<Array<Member>>([])

  // New states for PIs and Co-PIs
  const [pis, setPIs] = useState<string[]>([]);
  const [newPI, setNewPI] = useState<string>("");
  const [coPIs, setCoPIs] = useState<string[]>([]);
  const [newCoPI, setNewCoPI] = useState<string>("");

  // New state for installment dates
  const [installmentDates, setInstallmentDates] = useState<{ start_date: string; end_date: string }[]>([]);

  const fetchFaculties = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/member?type=faculty`, {
        credentials: 'include',
      });
      const data = await response.json();
      setFaculties(data);
    } catch (error) {
      toastError('Error fetching members');
      console.error('Error fetching members:', error);
    }
  };

  const calculateNumberOfYears = () => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Get the financial year start for the start and end dates
      const startYear = start.getMonth() < 3 ? start.getFullYear() - 1 : start.getFullYear();
      const endYear = end.getMonth() < 3 ? end.getFullYear() - 1 : end.getFullYear();

      const yearsDiff = endYear - startYear + 1;
      setNumberOfYears(yearsDiff >= 1 ? yearsDiff : 0);
    }
  };
  useEffect(calculateNumberOfYears, [startDate, endDate]);

  const addProjectHead = () => {
    // Check if the newHeadName is empty or if the project type and associated values are invalid
    if (!newHeadName || (projectType === "yearly" && numberOfYears <= 0) || (projectType === "invoice" && numberOfInstallments <= 0)) {
      return;
    }

    // Determine the count based on the project type
    const count = projectType === "yearly" ? numberOfYears : numberOfInstallments;

    // Update the projectHeads state
    setProjectHeads((prevHeads) => ({
      ...prevHeads,
      [newHeadName]: Array(count).fill(0),
    }));

    // Reset the newHeadName
    setNewHeadName("");
  };

  const handleProjectHeadYearChange = (headName: string, index: number, value: number) => {
    setProjectHeads((prevHeads) => ({
      ...prevHeads,
      [headName]: prevHeads[headName].map((val, idx) => (idx === index ? value : val)),
    }));
  };

  const saveProjectHead = (headName: string) => {
    const headTotal = projectHeads[headName].reduce((acc, val) => acc + val, 0);
    setHeadTotals((prevTotals) => ({ ...prevTotals, [headName]: headTotal }));
  };

  const editProjectHead = (headName: string) => {
    const updatedHeadTotals = { ...headTotals };
    delete updatedHeadTotals[headName];
    setHeadTotals(updatedHeadTotals);
  };

  const deleteProjectHead = (headName: string) => {
    const updatedHeads = { ...projectHeads };
    const updatedHeadTotals = { ...headTotals };
    delete updatedHeads[headName];
    delete updatedHeadTotals[headName];
    setProjectHeads(updatedHeads);
    setHeadTotals(updatedHeadTotals);
  };

  // Functions for managing PIs and Co-PIs
  const addPI = () => {
    if (newPI) {
      setPIs((prevPIs) => [...prevPIs, newPI]);
      setNewPI("");
    }
  };

  const deletePI = (index: number) => {
    setPIs((prevPIs) => prevPIs.filter((_, i) => i !== index));
  };

  const addCoPI = () => {
    if (newCoPI) {
      setCoPIs((prevCoPIs) => [...prevCoPIs, newCoPI]);
      setNewCoPI("");
    }
  };

  const deleteCoPI = (index: number) => {
    setCoPIs((prevCoPIs) => prevCoPIs.filter((_, i) => i !== index));
  };

  const handleAddProject: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append("project_name", projectName);
    formData.append("start_date", startDate ? new Date(startDate).toISOString() : "");
    formData.append("end_date", endDate ? new Date(endDate).toISOString() : "");
    formData.append("total_amount", totalAmount!.toString());
    formData.append("project_type", projectType);
    formData.append("pis", JSON.stringify(pis));
    formData.append("copis", JSON.stringify(coPIs));
    formData.append("project_heads", JSON.stringify(projectHeads));
    formData.append("project_head_expenses", JSON.stringify(headTotals));

    if (projectType === "invoice" && numberOfInstallments > 0) {
        formData.append("installments", JSON.stringify(installmentDates));
    }

    if (sanctionLetter) {
        formData.append("sanction_letter", sanctionLetter);
    }

    formData.append("description", description);

    try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/project/`, {
            method: "POST",
            body: formData,
            credentials: "include",
        });

        if (res.ok) {
            toastSuccess("Project added");
            setOpenModal(false);
        } else {
            toastError("Error adding project");
        }
    } catch (e) {
        toastError("Error");
        console.error(e);
    } finally {
        setLoading(false);
    }
};


  useEffect(() => {
    if (!openModal) {
      fetchFaculties()
      setProjectName("");
      setStartDate("");
      setEndDate("");
      setProjectHeads({});
      setHeadTotals({});
      setNumberOfYears(0);
      setNumberOfInstallments(0);
      setTotalAmount(null);
      setPIs([]);
      setCoPIs([]);
      setSanctionLetter(null);
      setInstallmentDates([]);
    }
  }, [openModal]);

  return (
    <div>
      <Modal show={openModal} size="4xl" popup onClose={() => setOpenModal(false)}>
        <Modal.Header className="p-5">
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">Add New Project</h3>
        </Modal.Header>
        <Modal.Body>
          <form onSubmit={handleAddProject} className="space-y-4">
            <div>
              <Label htmlFor="project_name" value="Project Name" />
              <TextInput
                id="project_name"
                placeholder="Enter project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label value="Project Type" />
              <div className="flex space-x-4">
                <Radio
                  id="yearly"
                  name="projectType"
                  value="yearly"
                  checked={projectType === "yearly"}
                  onChange={() => setProjectType("yearly")}
                />
                <Label htmlFor="yearly" value="Yearly" />

                <Radio
                  id="invoice"
                  name="projectType"
                  value="invoice"
                  checked={projectType === "invoice"}
                  onChange={() => setProjectType("invoice")}
                />
                <Label htmlFor="invoice" value="Invoice" />
              </div>
            </div>

            <div className="flex space-x-3">
              <div className="w-1/2">
                <Label htmlFor="start_date" value="Start Date" />
                <TextInput
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="w-1/2">
                <Label htmlFor="end_date" value="End Date" />
                <TextInput
                  id="end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {projectType === "invoice" ? (
              <div>
                <Label htmlFor="installments" value="Number of Installments" />
                <TextInput
                  id="installments"
                  type="number"
                  value={numberOfInstallments}
                  onChange={(e) => setNumberOfInstallments(Number(e.target.value))}
                  required
                />

                {numberOfInstallments > 0 && (
                  <div className="grid grid-cols-2 gap-y-6 mt-3">
                    {Array.from({ length: numberOfInstallments }).map((_, index) => (
                      <div key={index} className="flex space-x-2">
                        <div>
                          <Label htmlFor={`installment_start_${index}`} value={`Installment ${index + 1} Start Date`} />
                          <TextInput
                            id={`installment_start_${index}`}
                            type="date"
                            value={installmentDates[index]?.start_date || ""}
                            onChange={(e) => {
                              const updatedDates = [...installmentDates];
                              updatedDates[index] = {
                                ...updatedDates[index],
                                start_date: e.target.value,
                              };
                              setInstallmentDates(updatedDates);
                            }}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor={`installment_end_${index}`} value={`Installment ${index + 1} End Date`} />
                          <TextInput
                            id={`installment_end_${index}`}
                            type="date"
                            value={installmentDates[index]?.end_date || ""}
                            onChange={(e) => {
                              const updatedDates = [...installmentDates];
                              updatedDates[index] = {
                                ...updatedDates[index],
                                end_date: e.target.value,
                              };
                              setInstallmentDates(updatedDates);
                            }}
                            required
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : <div>
              <Label htmlFor="years" value="Number of Years" />
              <TextInput id="years" type="number" value={numberOfYears} readOnly />
            </div>}

            {/* Project Heads section */}
            <div>
              <Label htmlFor="head_name" value="Project Head" />
              <div className="flex items-center space-x-3">
                <TextInput
                  id="head_name"
                  value={newHeadName}
                  onChange={(e) => setNewHeadName(e.target.value)}
                  placeholder="Enter head name"
                />
                <Button color="blue" onClick={addProjectHead}>Add Project Head</Button>
              </div>
              {Object.keys(projectHeads).map((head) => (
                <div key={head} className="mt-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-lg">{head}</h4>
                    <div className="flex justify-end space-x-2">
                      <Button color="green" size="xs" onClick={() => saveProjectHead(head)}>
                        Save
                      </Button>
                      <Button color="yellow" size="xs" onClick={() => editProjectHead(head)}>
                        Edit
                      </Button>
                      <Button color="red" size="xs" onClick={() => deleteProjectHead(head)}>
                        Remove
                      </Button>

                    </div>
                  </div>
                  {projectHeads[head].map((_, idx) => (
                    <div key={idx} className="mt-2">

                      <TextInput
                        type="number"
                        value={projectHeads[head][idx]}
                        onChange={(e) => handleProjectHeadYearChange(head, idx, Number(e.target.value))}
                        required
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* PIs and Co-PIs */}
            <div className="flex justify-between">
              <div className="space-y-2">
                <datalist
                  id="pi_list">
                  {faculties.map(faculty => (
                    <option value={faculty.name} key={faculty._id}></option>
                  ))}
                </datalist>
                <Label htmlFor="pi" value="Add Principal Investigators (PIs)" />
                <div className="flex items-center space-x-3">
                  <TextInput
                    id="pi"
                    value={newPI}
                    onChange={(e) => setNewPI(e.target.value)}
                    placeholder="Enter PI name"
                    list="pi_list"
                  />
                  <Button color="blue" onClick={addPI}>Add PI</Button>
                </div>
                {pis.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-bold">PIs:</h4>
                    <ul>
                      {pis.map((pi, idx) => (
                        <li key={idx} className="flex justify-between">
                          <span>{pi}</span>
                          <Button color="blue" onClick={() => deletePI(idx)} type="button" size="xs">Delete</Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <datalist
                  id="co_pi_list">
                  {faculties.map(faculty => (
                    <option value={faculty.name} key={faculty._id}></option>
                  ))}
                </datalist>
                <Label value="Add Co-Principal Investigators (Co-PIs)" />
                <div className="flex items-center space-x-3">
                  <TextInput
                    value={newCoPI}
                    onChange={(e) => setNewCoPI(e.target.value)}
                    placeholder="Enter Co-PI name"
                    list="co_pi_list"
                  />
                  <Button color="blue" onClick={addCoPI}>Add Co-PI</Button>
                </div>
                {coPIs.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-bold">Co-PIs:</h4>
                    <ul>
                      {coPIs.map((coPI, idx) => (
                        <li key={idx} className="flex justify-between">
                          <span>{coPI}</span>
                          <Button color="blue" onClick={() => deleteCoPI(idx)} type="button" size="xs">Delete</Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {/* Add other fields like Total Amount, Description, etc */}
              <div>
                <Label htmlFor="total_amount" value="Total Amount" />
                <TextInput
                  id="total_amount"
                  type="number"
                  value={totalAmount ?? ""}
                  onChange={(e) => setTotalAmount(Number(e.target.value))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description" value="Project Description" />
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter description"
                  required
                />
              </div>

              <div>
                <Label htmlFor="sanction_letter" value="Sanction Letter" />
                <FileInput
                  id="sanction_letter"
                  onChange={(e) => {
                    if (!e.target.files) return
                    const file = e.target.files[0]
                    if (file && file.type !== "application/pdf") {
                      toastWarn("Please upload a PDF file.");
                      e.target.value = ""
                      return
                    }

                    const maxSizeInMB = 10;
                    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
                    if (file && file.size > maxSizeInBytes) {
                      toastWarn(`File size exceeds ${maxSizeInMB} MB. Please upload a smaller file.`);
                      e.target.value = ""
                      return;
                    }

                    setSanctionLetter(e.target.files ? e.target.files[0] : null)
                  }}
                  accept="application/pdf"
                />
              </div>
            </div>

            <div className="flex justify-center space-x-3 mt-4">
              <Button color="blue" type="submit" disabled={loading}>Save Project</Button>
              <Button color="failure" onClick={() => setOpenModal(false)} disabled={loading}>Cancel</Button>
            </div>
          </form>
        </Modal.Body>
      </Modal>
    </div>
  )
};
